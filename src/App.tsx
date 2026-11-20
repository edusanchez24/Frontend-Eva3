import { useEffect, useMemo, useState } from 'react'
import { apiRequest, clearTokens, getAccessToken, setTokens } from './api/client'
import type { Cliente, Producto, ProductoTalla, Venta } from './types'
import './App.css'

type CartItem = {
  key: string
  producto: Producto
  talla?: ProductoTalla
  cantidad: number
}

type IconName = 'bag' | 'user' | 'search' | 'grid' | 'close' | 'plus' | 'logout' | 'box' | 'users' | 'receipt'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    logout: <><path d="M10 5H5v14h5" /><path d="M14 8l4 4-4 4M8 12h10" /></>,
    box: <><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" /><path d="M4 7.5V17l8 4.5 8-4.5V7.5M12 12v9" /></>,
    users: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 21a6 6 0 0 1 12 0M14 17a4 4 0 0 1 7 4" /></>,
    receipt: <><path d="M6 3v18l3-2 3 2 3-2 3 2V3l-3 2-3-2-3 2-3-2Z" /><path d="M9 9h6M9 13h6" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function App() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'catalogo' | 'admin'>('catalogo')
  const [adminTab, setAdminTab] = useState<'productos' | 'clientes' | 'ventas'>('productos')
  const [cartOpen, setCartOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'error' } | null>(null)
  const [error, setError] = useState('')
  const [rutCliente, setRutCliente] = useState('')
  const [login, setLogin] = useState({ username: '', password: '' })
  const authenticated = Boolean(getAccessToken())

  function notify(message: string, type: 'ok' | 'error' = 'ok') {
    setToast({ message, type })
  }

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function loadCatalog() {
    setLoading(true)
    setError('')
    try {
      setProductos(await apiRequest<Producto[]>('/api/productos/'))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No se pudo cargar el catálogo.'
      setError(message)
      notify(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadAdminData() {
    setLoading(true)
    try {
      const [productosData, clientesData, ventasData] = await Promise.all([
        apiRequest<Producto[]>('/api/productos/'),
        apiRequest<Cliente[]>('/api/clientes/'),
        apiRequest<Venta[]>('/api/ventas/'),
      ])
      setProductos(productosData)
      setClientes(clientesData)
      setVentas(ventasData)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    apiRequest<Producto[]>('/api/productos/')
      .then((data) => {
        if (active) setProductos(data)
      })
      .catch((reason) => {
        if (!active) return
        const message = reason instanceof Error ? reason.message : 'No se pudo cargar el catálogo.'
        setError(message)
        notify(message, 'error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (view !== 'admin' || !authenticated) return
    let active = true
    Promise.all([
      apiRequest<Producto[]>('/api/productos/'),
      apiRequest<Cliente[]>('/api/clientes/'),
      apiRequest<Venta[]>('/api/ventas/'),
    ]).then(([productosData, clientesData, ventasData]) => {
      if (!active) return
      setProductos(productosData)
      setClientes(clientesData)
      setVentas(ventasData)
    }).catch((reason) => {
      if (active) notify(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos.', 'error')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [view, authenticated])

  const visibles = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return productos
    return productos.filter((item) => [item.nombre, item.codigo, item.descripcion].join(' ').toLowerCase().includes(term))
  }, [productos, query])

  const cartCount = cart.reduce((sum, item) => sum + item.cantidad, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.producto.precio * item.cantidad, 0)

  function addToCart(producto: Producto, talla?: ProductoTalla) {
    if (!producto.activo) return
    const available = talla?.stock ?? producto.stock
    if (available < 1) {
      notify('No hay unidades disponibles para esta talla.', 'error')
      return
    }
    const key = `${producto.id}-${talla?.id ?? 'base'}`
    setCart((current) => {
      const existing = current.find((item) => item.key === key)
      if (existing) {
        return current.map((item) => item.key === key
          ? { ...item, cantidad: Math.min(item.cantidad + 1, available) }
          : item)
      }
      return [...current, { key, producto, talla, cantidad: 1 }]
    })
    setCartOpen(true)
    notify(`${producto.nombre} agregado al carrito`)
  }

  function updateQuantity(key: string, delta: number) {
    setCart((current) => current
      .map((item) => item.key === key
        ? { ...item, cantidad: Math.min(item.cantidad + delta, item.talla?.stock ?? item.producto.stock) }
        : item)
      .filter((item) => item.cantidad > 0))
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest<{ access: string; refresh: string }>('/api/token/', {
        method: 'POST',
        body: JSON.stringify(login),
      })
      setTokens(result.access, result.refresh)
      setLoginOpen(false)
      setLogin({ username: '', password: '' })
      setView('admin')
      notify('Sesión iniciada')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.'
      setError(message)
      notify(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    clearTokens()
    setView('catalogo')
    notify('Sesión cerrada')
  }

  async function checkout() {
    if (!authenticated) {
      setCartOpen(false)
      setLoginOpen(true)
      return
    }
    if (!/^\d{1,10}-[\dKk]$/.test(rutCliente.trim())) {
      notify('Ingresa un RUT válido: 12345678-9', 'error')
      return
    }
    if (cart.length === 0) return
    setBusy(true)
    try {
      const rut = rutCliente.trim().toUpperCase()
      const cliente = clientes.find((item) => item.rut.toUpperCase() === rut)
      await apiRequest('/api/ventas/', {
        method: 'POST',
        body: JSON.stringify({
          rut_cliente: rut,
          ...(cliente ? { cliente: cliente.id } : {}),
          items: cart.map((item) => ({
            producto: item.producto.id,
            talla: item.talla?.id ?? null,
            cantidad: item.cantidad,
          })),
        }),
      })
      setCart([])
      setRutCliente('')
      setCartOpen(false)
      notify('Venta registrada')
      await loadCatalog()
      if (view === 'admin') await loadAdminData()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'No se pudo registrar la venta.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveProduct(payload: { id?: number; nombre: string; codigo: string; precio: number; descripcion: string; activo: boolean }) {
    setBusy(true)
    try {
      await apiRequest(`/api/productos/${payload.id ? `${payload.id}/` : ''}`, {
        method: payload.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          nombre: payload.nombre,
          codigo: payload.codigo || null,
          precio: payload.precio,
          descripcion: payload.descripcion,
          activo: payload.activo,
        }),
      })
      notify(payload.id ? 'Producto actualizado' : 'Producto creado')
      await loadAdminData()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'No se pudo guardar el producto.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteProduct(id: number) {
    if (!window.confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return
    setBusy(true)
    try {
      await apiRequest(`/api/productos/${id}/`, { method: 'DELETE' })
      notify('Producto eliminado')
      await loadAdminData()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'No se pudo eliminar el producto.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveSize(producto: number, talla: string, stock: number, id?: number) {
    setBusy(true)
    try {
      await apiRequest(`/api/producto-tallas/${id ? `${id}/` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify({ producto, talla, stock }),
      })
      notify(id ? 'Talla actualizada' : 'Talla creada')
      await loadAdminData()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'No se pudo guardar la talla.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSize(id: number) {
    if (!window.confirm('¿Eliminar esta talla?')) return
    setBusy(true)
    try {
      await apiRequest(`/api/producto-tallas/${id}/`, { method: 'DELETE' })
      notify('Talla eliminada')
      await loadAdminData()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'No se pudo eliminar la talla.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveClient(payload: Cliente | Omit<Cliente, 'id'>) {
    setBusy(true)
    const id = 'id' in payload ? payload.id : undefined
    try {
      await apiRequest(`/api/clientes/${id ? `${id}/` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      notify(id ? 'Cliente actualizado' : 'Cliente creado')
      await loadAdminData()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'No se pudo guardar el cliente.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteClient(id: number) {
    if (!window.confirm('¿Eliminar este cliente?')) return
    setBusy(true)
    try {
      await apiRequest(`/api/clientes/${id}/`, { method: 'DELETE' })
      notify('Cliente eliminado')
      await loadAdminData()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'No se pudo eliminar el cliente.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('catalogo')} aria-label="Ir al catálogo">
          <span className="brand-slashes">//</span>
          <span>SNEAK<strong>CTRL</strong></span>
        </button>
        <nav className="nav-links" aria-label="Navegación principal">
          <button className={view === 'catalogo' ? 'active' : ''} onClick={() => setView('catalogo')}>Catálogo</button>
          {authenticated && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Control</button>}
        </nav>
        <div className="header-actions">
          {authenticated
            ? <button className="icon-button" onClick={logout} aria-label="Cerrar sesión"><Icon name="logout" /></button>
            : <button className="icon-button" onClick={() => setLoginOpen(true)} aria-label="Iniciar sesión"><Icon name="user" /></button>}
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito, ${cartCount} productos`}>
            <Icon name="bag" /><span>Bolsa</span><b>{cartCount}</b>
          </button>
        </div>
      </header>

      {toast && <div className={`toast ${toast.type}`} role="status">{toast.message}</div>}

      {view === 'catalogo' ? (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <p className="hero-kicker">DROP / 2026</p>
              <h1>CONTROL<br /><span>THE MOVE.</span></h1>
              <p className="hero-description">Zapatillas seleccionadas para el ritmo de la ciudad. Stock real, tallas exactas y entregas en Chile.</p>
              <a className="primary-button" href="#catalogo">Ver colección <span>→</span></a>
            </div>
            <div className="hero-visual" aria-label="Zapatilla Hypervenom clásica">
              <div className="speed-lines" />
              <div className="hero-shoe"><ShoeArtwork /></div>
              <span className="hero-code">HV / 01</span>
            </div>
          </section>

          <section className="ticker" aria-label="Beneficios">
            <span>STOCK VERIFICADO</span><i>///</i><span>CURACIÓN URBANA</span><i>///</i><span>VENTA ATÓMICA</span><i>///</i><span>CHILE</span>
          </section>

          <section className="catalog-section" id="catalogo">
            <div className="section-heading">
              <div><p className="section-kicker">CATÁLOGO / {productos.length} MODELOS</p><h2>Últimos <span>drop</span></h2></div>
              <label className="search-wrap"><Icon name="search" size={18} /><span className="sr-only">Buscar productos</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelo o código" /></label>
            </div>
            {error && <div className="alert" role="alert">{error}</div>}
            {loading ? (
              <div className="product-grid" aria-label="Cargando catálogo">{[1, 2, 3, 4].map((item) => <div className="skeleton-card" key={item}><div /><div /><div /></div>)}</div>
            ) : visibles.length === 0 ? (
              <div className="empty-state"><Icon name="box" size={38} /><h3>No encontramos productos</h3><p>Prueba con otro nombre o código.</p></div>
            ) : (
              <div className="product-grid">{visibles.map((producto, index) => <ProductCard key={producto.id} producto={producto} index={index} onAdd={addToCart} />)}</div>
            )}
          </section>
        </main>
      ) : (
        <main className="admin-shell">
          <aside className="admin-sidebar">
            <p>OPERACIONES</p>
            <button className={adminTab === 'productos' ? 'active' : ''} onClick={() => setAdminTab('productos')}><Icon name="box" />Productos</button>
            <button className={adminTab === 'clientes' ? 'active' : ''} onClick={() => setAdminTab('clientes')}><Icon name="users" />Clientes</button>
            <button className={adminTab === 'ventas' ? 'active' : ''} onClick={() => setAdminTab('ventas')}><Icon name="receipt" />Ventas</button>
          </aside>
          <section className="admin-content">
            {loading ? <div className="admin-loading"><span className="spinner" /><p>Cargando operaciones...</p></div> : adminTab === 'productos'
              ? <ProductsAdmin productos={productos} busy={busy} onSave={saveProduct} onDelete={deleteProduct} onSaveSize={saveSize} onDeleteSize={deleteSize} />
              : adminTab === 'clientes'
                ? <ClientsAdmin clientes={clientes} busy={busy} onSave={saveClient} onDelete={deleteClient} />
                : <SalesAdmin ventas={ventas} />}
          </section>
        </main>
      )}

      {cartOpen && <CartDrawer cart={cart} total={cartTotal} rut={rutCliente} setRut={setRutCliente} onClose={() => setCartOpen(false)} onUpdate={updateQuantity} onCheckout={checkout} busy={busy} authenticated={authenticated} />}
      {loginOpen && <LoginModal busy={busy} error={error} login={login} setLogin={setLogin} onClose={() => { setLoginOpen(false); setError('') }} onSubmit={signIn} />}
    </div>
  )
}

function ShoeArtwork() {
  return <div className="shoe-art" aria-hidden="true"><div className="shoe-laces"><i /><i /><i /><i /></div><div className="shoe-upper" /><div className="shoe-sole" /></div>
}

function ProductCard({ producto, index, onAdd }: { producto: Producto; index: number; onAdd: (producto: Producto, talla?: ProductoTalla) => void }) {
  const [selected, setSelected] = useState<ProductoTalla | undefined>(producto.tallas.find((item) => item.stock > 0))
  const available = selected?.stock ?? producto.stock
  return (
    <article className={`product-card tone-${index % 4}`}>
      <div className="product-image">
        <span className="product-index">{String(index + 1).padStart(2, '0')}</span>
        <ShoeArtwork />
        <span className="stock-badge">{available > 0 ? `${available} un.` : 'Agotado'}</span>
      </div>
      <div className="product-info">
        <div><h3>{producto.nombre}</h3><p>{producto.codigo ? `SKU ${producto.codigo}` : 'Producto sin código'}</p></div>
        <strong>{formatPrice(producto.precio)}</strong>
      </div>
      {producto.tallas.length > 0 && (
        <div className="size-list" aria-label="Tallas disponibles">
          {producto.tallas.map((talla) => <button key={talla.id} className={selected?.id === talla.id ? 'selected' : ''} disabled={talla.stock === 0} onClick={() => setSelected(talla)}>{talla.talla}</button>)}
        </div>
      )}
      <button className="add-button" disabled={!producto.activo || available === 0} onClick={() => onAdd(producto, selected)}>
        {available === 0 ? 'Sin stock' : 'Agregar'} <Icon name="plus" size={17} />
      </button>
    </article>
  )
}

function CartDrawer({ cart, total, rut, setRut, onClose, onUpdate, onCheckout, busy, authenticated }: {
  cart: CartItem[]
  total: number
  rut: string
  setRut: (value: string) => void
  onClose: () => void
  onUpdate: (key: string, delta: number) => void
  onCheckout: () => void
  busy: boolean
  authenticated: boolean
}) {
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="cart-drawer" aria-label="Carrito">
        <div className="drawer-heading"><div><p>MI BOLSA</p><h2>{cart.length} {cart.length === 1 ? 'producto' : 'productos'}</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar carrito"><Icon name="close" /></button></div>
        {cart.length === 0 ? (
          <div className="empty-cart"><Icon name="bag" size={42} /><h3>La bolsa está vacía</h3><p>Elige una talla para comenzar.</p></div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.key}>
                  <div className="mini-product"><ShoeArtwork /></div>
                  <div className="cart-item-copy"><strong>{item.producto.nombre}</strong><small>{item.talla ? `Talla ${item.talla.talla}` : 'Sin talla'} · {item.producto.codigo}</small><b>{formatPrice(item.producto.precio * item.cantidad)}</b></div>
                  <div className="quantity"><button onClick={() => onUpdate(item.key, -1)} aria-label="Restar unidad">−</button><span>{item.cantidad}</span><button onClick={() => onUpdate(item.key, 1)} aria-label="Sumar unidad">+</button></div>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <div><span>Total</span><strong>{formatPrice(total)}</strong></div>
              {authenticated && <label>RUT del cliente<input value={rut} onChange={(event) => setRut(event.target.value)} placeholder="12345678-9" /></label>}
              <button className="primary-button full" onClick={onCheckout} disabled={busy}>
                {busy ? <><span className="spinner small" />Procesando</> : authenticated ? 'Confirmar venta →' : 'Iniciar sesión para comprar →'}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

function LoginModal({ busy, error, login, setLogin, onClose, onSubmit }: {
  busy: boolean
  error: string
  login: { username: string; password: string }
  setLogin: (value: { username: string; password: string }) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="login-card" onSubmit={onSubmit} aria-label="Iniciar sesión">
        <button type="button" className="close-button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        <p className="login-kicker">SNEAK//CTRL</p><h2>Acceso control</h2>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label htmlFor="username">Usuario<input id="username" autoComplete="username" required value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} /></label>
        <label htmlFor="password">Contraseña<input id="password" type="password" autoComplete="current-password" required value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>
        <button className="primary-button full" disabled={busy}>{busy ? <><span className="spinner small" />Ingresando</> : 'Iniciar sesión'}</button>
      </form>
    </div>
  )
}

function ProductForm({ producto, busy, onSave, onCancel }: { producto?: Producto; busy: boolean; onSave: (payload: { id?: number; nombre: string; codigo: string; precio: number; descripcion: string; activo: boolean }) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ nombre: producto?.nombre ?? '', codigo: producto?.codigo ?? '', precio: producto?.precio ?? 0, descripcion: producto?.descripcion ?? '', activo: producto?.activo ?? true })
  return <form className="data-form" onSubmit={(event) => { event.preventDefault(); onSave({ id: producto?.id, ...form }) }}><h3>{producto ? 'Editar producto' : 'Nuevo producto'}</h3><div className="form-grid"><label>Nombre<input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label><label>Código<input value={form.codigo} onChange={(event) => setForm({ ...form, codigo: event.target.value })} /></label><label>Precio<input required type="number" min="0" value={form.precio} onChange={(event) => setForm({ ...form, precio: Number(event.target.value) })} /></label><label className="check-label"><input type="checkbox" checked={form.activo} onChange={(event) => setForm({ ...form, activo: event.target.checked })} />Activo</label></div><label>Descripción<textarea rows={3} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Guardando...' : 'Guardar'}</button></div></form>
}

function ProductsAdmin({ productos, busy, onSave, onDelete, onSaveSize, onDeleteSize }: { productos: Producto[]; busy: boolean; onSave: (payload: { id?: number; nombre: string; codigo: string; precio: number; descripcion: string; activo: boolean }) => void; onDelete: (id: number) => void; onSaveSize: (producto: number, talla: string, stock: number, id?: number) => void; onDeleteSize: (id: number) => void }) {
  const [editing, setEditing] = useState<Producto | null | undefined>(undefined)
  const [sizeProduct, setSizeProduct] = useState<number | null>(null)
  const [sizeForm, setSizeForm] = useState({ talla: '', stock: 0, id: undefined as number | undefined })
  return (
    <div>
      <div className="admin-heading"><div><p>INVENTARIO</p><h2>Productos</h2></div><button className="primary-button" onClick={() => setEditing(null)}>Nuevo producto <Icon name="plus" size={16} /></button></div>
      {editing !== undefined && <ProductForm producto={editing ?? undefined} busy={busy} onSave={(payload) => { onSave(payload); setEditing(undefined) }} onCancel={() => setEditing(undefined)} />}
      <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Código</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Tallas</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{productos.map((producto) => <tr key={producto.id}><td><strong>{producto.nombre}</strong></td><td>{producto.codigo || '—'}</td><td>{formatPrice(producto.precio)}</td><td>{producto.stock}</td><td><span className={`status ${producto.activo ? 'live' : 'off'}`}>{producto.activo ? 'Activo' : 'Inactivo'}</span></td><td><div className="size-admin">{producto.tallas.map((talla) => <button key={talla.id} title={`Editar talla ${talla.talla}`} onClick={() => { setSizeProduct(producto.id); setSizeForm({ talla: talla.talla, stock: talla.stock, id: talla.id }) }}>{talla.talla}: {talla.stock}</button>)}</div></td><td><div className="row-actions"><button onClick={() => setEditing(producto)}>Editar</button><button onClick={() => { setSizeProduct(producto.id); setSizeForm({ talla: '', stock: 0, id: undefined }) }}>Talla</button><button className="danger" onClick={() => onDelete(producto.id)}>Eliminar</button></div></td></tr>)}</tbody></table></div>
      {sizeProduct && <form className="size-form" onSubmit={(event) => { event.preventDefault(); onSaveSize(sizeProduct, sizeForm.talla, sizeForm.stock, sizeForm.id); setSizeProduct(null) }}><h3>{sizeForm.id ? 'Editar talla' : 'Nueva talla'}</h3><label>Talla<input required value={sizeForm.talla} onChange={(event) => setSizeForm({ ...sizeForm, talla: event.target.value })} /></label><label>Stock<input required type="number" min="0" value={sizeForm.stock} onChange={(event) => setSizeForm({ ...sizeForm, stock: Number(event.target.value) })} /></label><div className="form-actions">{sizeForm.id && <button type="button" className="danger-button" onClick={() => { onDeleteSize(sizeForm.id!); setSizeProduct(null) }}>Eliminar talla</button>}<button type="button" className="secondary-button" onClick={() => setSizeProduct(null)}>Cancelar</button><button className="primary-button" disabled={busy}>Guardar</button></div></form>}
    </div>
  )
}

function ClientsAdmin({ clientes, busy, onSave, onDelete }: { clientes: Cliente[]; busy: boolean; onSave: (payload: Cliente | Omit<Cliente, 'id'>) => void; onDelete: (id: number) => void }) {
  const [editing, setEditing] = useState<Cliente | null | undefined>(undefined)
  const empty = { rut: '', nombre: '', telefono: '', direccion: '', correo: '' }
  const [form, setForm] = useState(editing ? { ...editing } : empty)
  function openNew() { setEditing(null); setForm(empty) }
  function openEdit(cliente: Cliente) { setEditing(cliente); setForm({ ...cliente }) }
  return <div><div className="admin-heading"><div><p>DIRECTORIO</p><h2>Clientes</h2></div><button className="primary-button" onClick={openNew}>Nuevo cliente <Icon name="plus" size={16} /></button></div>{editing !== undefined && <form className="data-form" onSubmit={(event) => { event.preventDefault(); onSave(editing ? { ...form, id: editing.id } : form); setEditing(undefined) }}><h3>{editing ? 'Editar cliente' : 'Nuevo cliente'}</h3><div className="form-grid"><label>RUT<input required pattern="[0-9]{1,10}-[0-9Kk]" value={form.rut} onChange={(event) => setForm({ ...form, rut: event.target.value })} /></label><label>Nombre<input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label><label>Teléfono<input value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /></label><label>Correo<input type="email" value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} /></label></div><label>Dirección<input value={form.direccion} onChange={(event) => setForm({ ...form, direccion: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(undefined)}>Cancelar</button><button className="primary-button" disabled={busy}>Guardar</button></div></form>}<div className="table-wrap"><table><thead><tr><th>RUT</th><th>Nombre</th><th>Contacto</th><th>Dirección</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{clientes.map((cliente) => <tr key={cliente.id}><td><strong>{cliente.rut}</strong></td><td>{cliente.nombre}</td><td>{cliente.correo || cliente.telefono || '—'}</td><td>{cliente.direccion || '—'}</td><td><div className="row-actions"><button onClick={() => openEdit(cliente)}>Editar</button><button className="danger" onClick={() => onDelete(cliente.id)}>Eliminar</button></div></td></tr>)}</tbody></table></div></div>
}

function SalesAdmin({ ventas }: { ventas: Venta[] }) {
  return <div><div className="admin-heading"><div><p>HISTORIAL</p><h2>Ventas</h2></div></div><div className="table-wrap"><table><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>RUT</th><th>Detalle</th><th>Total</th></tr></thead><tbody>{ventas.map((venta) => <tr key={venta.id}><td><strong>#{venta.id}</strong></td><td>{formatDate(venta.fecha)}</td><td>{venta.cliente_detalle?.nombre || 'Venta directa'}</td><td>{venta.rut_cliente}</td><td>{venta.detalles.reduce((sum, item) => sum + item.cantidad, 0)} ítem(s)</td><td><strong>{formatPrice(venta.total)}</strong></td></tr>)}</tbody></table></div></div>
}

export default App
