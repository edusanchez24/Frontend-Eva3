export type ProductoTalla = {
  id: number
  producto: number
  talla: string
  stock: number
}

export type Producto = {
  id: number
  nombre: string
  codigo: string | null
  precio: number
  descripcion: string
  stock: number
  activo: boolean
  tallas: ProductoTalla[]
}

export type Cliente = {
  id: number
  rut: string
  nombre: string
  telefono: string
  direccion: string
  correo: string
}

export type VentaDetalle = {
  id: number
  producto: number
  talla: number | null
  cantidad: number
  subtotal: number
}

export type Venta = {
  id: number
  rut_cliente: string
  cliente: number | null
  cliente_detalle: Cliente | null
  total: number
  fecha: string
  detalles: VentaDetalle[]
}

