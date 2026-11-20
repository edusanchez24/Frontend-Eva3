from django.db import transaction
from rest_framework import permissions, routers, viewsets
from rest_framework.exceptions import ValidationError

from .models import Cliente, Producto, ProductoTalla, Venta, VentaDetalle
from .serializers import (
    ClienteSerializer,
    ProductoSerializer,
    ProductoTallaSerializer,
    VentaDetalleSerializer,
    VentaSerializer,
)

class CatalogReadOnly(permissions.IsAuthenticatedOrReadOnly):
    pass


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.prefetch_related('tallas').all()
    serializer_class = ProductoSerializer
    permission_classes = (CatalogReadOnly,)

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(activo=True)
        return queryset


class ProductoTallaViewSet(viewsets.ModelViewSet):
    queryset = ProductoTalla.objects.select_related('producto').all()
    serializer_class = ProductoTallaSerializer
    permission_classes = (CatalogReadOnly,)


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = (permissions.IsAuthenticated,)


class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.select_related('cliente').prefetch_related(
        'detalles__producto',
        'detalles__talla',
    ).all()
    serializer_class = VentaSerializer
    permission_classes = (permissions.IsAuthenticated,)

    @transaction.atomic
    def perform_create(self, serializer):
        items = serializer.validated_data.pop('items', [])
        if not items:
            raise ValidationError({'items': 'Debes incluir al menos un producto.'})
        venta = serializer.save()
        for item in items:
            producto = Producto.objects.select_for_update().get(pk=item['producto'].pk)
            talla = item.get('talla')
            locked_talla = None
            if talla:
                locked_talla = ProductoTalla.objects.select_for_update().get(pk=talla.pk)
                if locked_talla.producto_id != producto.pk:
                    raise ValidationError({'items': 'La talla no pertenece al producto.'})
                disponible = locked_talla.stock
            else:
                disponible = producto.stock
            cantidad = item['cantidad']
            if cantidad > disponible:
                raise ValidationError(
                    {'items': f'Solo hay {disponible} unidades para {producto}.'}
                )
            VentaDetalle.objects.create(
                venta=venta,
                producto=producto,
                talla=locked_talla,
                cantidad=cantidad,
            )
            if locked_talla:
                locked_talla.stock -= cantidad
                locked_talla.save(update_fields=('stock',))
            else:
                producto.stock -= cantidad
                producto.save(update_fields=('stock',))
        venta.recalcular_total()


class VentaDetalleViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalle.objects.select_related(
        'venta',
        'producto',
        'talla',
    ).all()
    serializer_class = VentaDetalleSerializer
    permission_classes = (permissions.IsAuthenticated,)

    @transaction.atomic
    def perform_create(self, serializer):
        detalle_data = serializer.validated_data
        producto = Producto.objects.select_for_update().get(
            pk=detalle_data['producto'].pk
        )
        talla = detalle_data.get('talla')
        if talla:
            talla = ProductoTalla.objects.select_for_update().get(pk=talla.pk)
            stock = talla.stock
        else:
            stock = producto.stock
        cantidad = detalle_data['cantidad']
        if cantidad > stock:
            raise ValidationError(
                {'cantidad': f'Solo hay {stock} unidades disponibles.'}
            )

        detalle = serializer.save(producto=producto, talla=talla)
        if talla:
            talla.stock -= cantidad
            talla.save(update_fields=('stock',))
        else:
            producto.stock -= cantidad
            producto.save(update_fields=('stock',))

    @transaction.atomic
    def perform_update(self, serializer):
        instance = self.get_object()
        old_producto = (
            Producto.objects.select_for_update().get(pk=instance.producto_id)
            if instance.producto_id
            else None
        )
        old_talla = (
            ProductoTalla.objects.select_for_update().get(pk=instance.talla_id)
            if instance.talla_id
            else None
        )
        new_producto = serializer.validated_data.get('producto', old_producto)
        new_talla = serializer.validated_data.get('talla', old_talla)
        cantidad = serializer.validated_data.get('cantidad', instance.cantidad)
        if new_talla and new_producto and new_talla.producto_id != new_producto.pk:
            raise ValidationError(
                {'talla': 'La talla seleccionada no pertenece al producto.'}
            )

        locked_products = {}
        for producto in (old_producto, new_producto):
            if producto and producto.pk not in locked_products:
                locked_products[producto.pk] = Producto.objects.select_for_update().get(
                    pk=producto.pk
                )
        locked_tallas = {}
        for talla in (old_talla, new_talla):
            if talla and talla.pk not in locked_tallas:
                locked_tallas[talla.pk] = ProductoTalla.objects.select_for_update().get(
                    pk=talla.pk
                )

        if old_talla:
            locked_tallas[old_talla.pk].stock += instance.cantidad
        elif old_producto:
            locked_products[old_producto.pk].stock += instance.cantidad

        available = (
            locked_tallas[new_talla.pk].stock
            if new_talla
            else locked_products[new_producto.pk].stock
        )
        if cantidad > available:
            raise ValidationError(
                {'cantidad': f'Solo hay {available} unidades disponibles.'}
            )

        if new_talla:
            locked_tallas[new_talla.pk].stock -= cantidad
        else:
            locked_products[new_producto.pk].stock -= cantidad

        serializer.save(producto=locked_products.get(new_producto.pk, new_producto),
                        talla=locked_tallas.get(new_talla.pk, new_talla),
                        cantidad=cantidad)
        for producto in locked_products.values():
            producto.save(update_fields=('stock',))
        for talla in locked_tallas.values():
            talla.save(update_fields=('stock',))

    @transaction.atomic
    def perform_destroy(self, instance):
        producto = (
            Producto.objects.select_for_update().get(pk=instance.producto_id)
            if instance.producto_id
            else None
        )
        talla = (
            ProductoTalla.objects.select_for_update().get(pk=instance.talla_id)
            if instance.talla_id
            else None
        )
        if talla:
            talla.stock += instance.cantidad
            talla.save(update_fields=('stock',))
        elif producto:
            producto.stock += instance.cantidad
            producto.save(update_fields=('stock',))
        instance.delete()


router = routers.DefaultRouter()
router.register(r'productos', ProductoViewSet)
router.register(r'producto-tallas', ProductoTallaViewSet)
router.register(r'clientes', ClienteViewSet)
router.register(r'ventas', VentaViewSet)
router.register(r'venta-detalles', VentaDetalleViewSet)
