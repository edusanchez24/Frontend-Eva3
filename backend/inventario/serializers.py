from rest_framework import serializers

from .models import Cliente, Producto, ProductoTalla, Venta, VentaDetalle


class ProductoSerializer(serializers.ModelSerializer):
    tallas = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = ('id', 'nombre', 'codigo', 'precio', 'descripcion', 'stock', 'activo', 'tallas')
        read_only_fields = ('stock',)

    def get_tallas(self, obj):
        return ProductoTallaSerializer(obj.tallas.all(), many=True).data


class ProductoTallaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductoTalla
        fields = '__all__'

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError('El stock no puede ser negativo.')
        return value

    def validate(self, attrs):
        producto = attrs.get('producto', getattr(self.instance, 'producto', None))
        talla = attrs.get('talla', getattr(self.instance, 'talla', None))
        if producto and producto.tallas.exclude(pk=getattr(self.instance, 'pk', None)).filter(
            talla=talla
        ).exists():
            raise serializers.ValidationError(
                {'talla': 'Ya existe esta talla para el producto seleccionado.'}
            )
        return attrs


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'

    def validate_rut(self, value):
        import re
        if not re.fullmatch(r'\d{1,10}-[\dKk]', value):
            raise serializers.ValidationError('Usa un RUT con formato 12345678-9.')
        return value.upper()


class VentaDetalleWriteSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    talla = serializers.PrimaryKeyRelatedField(
        queryset=ProductoTalla.objects.all(), required=False, allow_null=True
    )
    cantidad = serializers.IntegerField(min_value=1)

    def validate_cantidad(self, value):
        if value < 1:
            raise serializers.ValidationError('La cantidad debe ser al menos 1.')
        return value


class VentaDetalleSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalle
        fields = '__all__'
        read_only_fields = ('subtotal',)

    def validate_cantidad(self, value):
        if value < 1:
            raise serializers.ValidationError('La cantidad debe ser al menos 1.')
        return value

    def validate(self, attrs):
        producto = attrs.get('producto', getattr(self.instance, 'producto', None))
        talla = attrs.get('talla', getattr(self.instance, 'talla', None))
        cantidad = attrs.get('cantidad', getattr(self.instance, 'cantidad', None))

        if talla and producto and talla.producto_id != producto.pk:
            raise serializers.ValidationError(
                {'talla': 'La talla seleccionada no pertenece al producto.'}
            )
        if cantidad is not None and cantidad < 1:
            raise serializers.ValidationError(
                {'cantidad': 'La cantidad debe ser al menos 1.'}
            )
        return attrs


class VentaSerializer(serializers.ModelSerializer):
    cliente_detalle = ClienteSerializer(source='cliente', read_only=True)
    detalles = VentaDetalleSerializer(many=True, read_only=True)
    items = VentaDetalleWriteSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Venta
        fields = (
            'id', 'rut_cliente', 'cliente', 'cliente_detalle', 'total', 'fecha',
            'detalles', 'items',
        )
        read_only_fields = ('total', 'fecha')

    def validate_rut_cliente(self, value):
        import re
        if value and not re.fullmatch(r'\d{1,10}-[\dKk]', value):
            raise serializers.ValidationError('Usa un RUT con formato 12345678-9.')
        return value.upper() if value else value
