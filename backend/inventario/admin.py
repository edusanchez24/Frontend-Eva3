from django.contrib import admin
from django.db.models import Sum
from django.utils.dateparse import parse_date
from .models import Cliente, Producto, ProductoTalla, Venta, VentaDetalle


admin.site.site_header = 'SNEAK//CTRL · Administración'
admin.site.site_title = 'SNEAK//CTRL'
admin.site.index_title = 'Centro de control'


class StockStatusFilter(admin.SimpleListFilter):
    title = 'estado de stock'
    parameter_name = 'stock_status'

    def lookups(self, request, model_admin):
        return (
            ('available', 'Con stock'),
            ('empty', 'Agotados'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'available':
            return queryset.filter(stock__gt=0)
        if self.value() == 'empty':
            return queryset.filter(stock=0)
        return queryset


@admin.action(description='Activar productos seleccionados')
def activate_products(modeladmin, request, queryset):
    queryset.update(activo=True)


@admin.action(description='Desactivar productos seleccionados')
def deactivate_products(modeladmin, request, queryset):
    queryset.update(activo=False)


@admin.action(description='Recalcular stock desde las tallas')
def recalculate_product_stock(modeladmin, request, queryset):
    for producto in queryset.prefetch_related('tallas'):
        producto.actualizar_stock_total()


class ProductoTallaInline(admin.TabularInline):
    model = ProductoTalla
    extra = 1
    fields = ('talla', 'stock')
    ordering = ('talla',)


class ProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'codigo', 'precio', 'stock', 'activo')
    list_display_links = ('nombre', 'codigo')
    list_filter = (StockStatusFilter, 'activo')
    search_fields = ('nombre', 'codigo', 'descripcion')
    ordering = ('nombre', 'stock')
    list_per_page = 25
    actions = (activate_products, deactivate_products, recalculate_product_stock)
    inlines = (ProductoTallaInline,)
    fieldsets = (
        ('Identificación', {
            'fields': ('nombre', 'codigo', 'descripcion'),
        }),
        ('Precio y disponibilidad', {
            'fields': ('precio', 'stock', 'activo'),
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        # Con tallas, el total se mantiene desde el inline y no debe editarse a mano.
        if obj and obj.tallas.exists():
            return ('stock',)
        return ()


@admin.register(ProductoTalla)
class ProductoTallaAdmin(admin.ModelAdmin):
    list_display = ('producto', 'talla', 'stock')
    list_filter = ('talla',)
    search_fields = ('producto__nombre', 'producto__codigo', 'talla')
    autocomplete_fields = ('producto',)
    ordering = ('producto__nombre', 'talla')
    list_per_page = 25


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('rut', 'nombre', 'telefono', 'correo')
    search_fields = ('rut', 'nombre', 'telefono', 'correo')
    list_filter = ('correo',)
    ordering = ('nombre', 'rut')
    list_per_page = 25
    fieldsets = (
        ('Datos del cliente', {
            'fields': ('rut', 'nombre', 'telefono', 'correo', 'direccion'),
        }),
    )


class VentaDetalleInline(admin.TabularInline):
    # El detalle se edita dentro de la venta y se guarda en la misma base Supabase
    # mediante el ORM, sin que el administrador tenga que cambiar de pantalla.
    model = VentaDetalle
    extra = 1
    fields = ('producto', 'talla', 'cantidad', 'subtotal')
    readonly_fields = ('subtotal',)
    autocomplete_fields = ('producto', 'talla')


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    inlines = (VentaDetalleInline,)
    change_list_template = 'admin/inventario/venta/change_list.html'
    list_display = ('id', 'fecha', 'cliente', 'rut_cliente', 'total')
    list_filter = ('fecha', 'cliente')
    date_hierarchy = 'fecha'
    search_fields = (
        'rut_cliente',
        'cliente__rut',
        'cliente__nombre',
        'detalles__producto__nombre',
        'detalles__producto__codigo',
    )
    ordering = ('-fecha',)
    list_select_related = ('cliente',)
    list_per_page = 25

    def get_queryset(self, request):
        # El rango se aplica al queryset antes de contar o sumar, por lo que el
        # reporte representa exactamente el periodo seleccionado.
        queryset = super().get_queryset(request)
        fecha_desde = parse_date(request.GET.get('fecha_desde', ''))
        fecha_hasta = parse_date(request.GET.get('fecha_hasta', ''))
        if fecha_desde:
            queryset = queryset.filter(fecha__date__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha__date__lte=fecha_hasta)
        return queryset

    def changelist_view(self, request, extra_context=None):
        # Sum y count son agregaciones SQL ejecutadas por Django sobre Supabase.
        queryset = self.get_queryset(request)
        resumen = queryset.aggregate(
            total_ventas=Sum('total'),
        )
        contexto = {
            'fecha_desde': request.GET.get('fecha_desde', ''),
            'fecha_hasta': request.GET.get('fecha_hasta', ''),
            'total_ventas_periodo': resumen['total_ventas'] or 0,
            'cantidad_ventas_periodo': queryset.count(),
        }
        if extra_context:
            contexto.update(extra_context)
        return super().changelist_view(request, extra_context=contexto)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.recalcular_total()


admin.site.register(Producto, ProductoAdmin)
