import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Size = {
  id: number
  talla: string
  stock: number
  producto: number
}

type Product = {
  id: number
  nombre: string
  codigo: string | null
  precio: number
  descripcion: string
  stock: number
  activo: boolean
  tallas: Size[]
}

type CartItem = {
  key: string
  product: Product
  size?: Size
  quantity: number
}

type AuthTokens = {
  access: string
  refresh: string
}

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as Record<string, unknown> | null
    const message = body
      ? Object.values(body).flat().join(' ')
      : `Error ${response.status}: no se pudo completar la solicitud.`
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [login, setLogin] = useState({ username: '', password: '' })
  const [tokens, setTokens] = useState<AuthTokens | null>(() => {
    const saved = localStorage.getItem('eva3-tokens')
    return saved ? JSON.parse(saved) as AuthTokens : null
  })
  const [customerRut, setCustomerRut] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    request<Product[]>('/productos/')
      .then(setProducts)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return products
    return products.filter((product) =>
      [product.nombre, product.descripcion, product.codigo ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    )
  }, [products, query])

  const cartTotal = cart.reduce((total, item) => total + item.product.precio * item.quantity, 0)
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)

  function addToCart(product: Product, size?: Size) {
    const key = `${product.id}-${size?.id ?? 'base'}`
    setCart((current) => {
      const existing = current.find((item) => item.key === key)
      if (existing) {
        return current.map((item) => item.key === key
          ? { ...item, quantity: Math.min(item.quantity + 1, size?.stock ?? product.stock) }
          : item)
      }
      return [...current, { key, product, size, quantity: 1 }]
    })
    setNotice(`${product.nombre} se agregó al carrito`)
    setTimeout(() => setNotice(''), 2500)
  }

  function updateQuantity(key: string, amount: number) {
    setCart((current) => current
      .map((item) => item.key === key ? { ...item, quantity: item.quantity + amount } : item)
      .filter((item) => item.quantity > 0))
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await request<AuthTokens>('/token/', {
        method: 'POST',
        body: JSON.stringify(login),
      })
      setTokens(result)
      localStorage.setItem('eva3-tokens', JSON.stringify(result))
      setLoginOpen(false)
      setLogin({ username: '', password: '' })
      setNotice('Sesión iniciada correctamente')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function checkout() {
    if (!tokens) {
      setLoginOpen(true)
      return
    }
    if (!customerRut.match(/^\d{1,10}-[\dKk]$/)) {
      setError('Ingresa un RUT válido, por ejemplo 12345678-9.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await request('/ventas/', {
        method: 'POST',
        body: JSON.stringify({
          rut_cliente: customerRut.toUpperCase(),
          items: cart.map((item) => ({
            producto: item.product.id,
            talla: item.size?.id ?? null,
            cantidad: item.quantity,
          })),
        }),
      }, tokens.access)
      setCart([])
      setCustomerRut('')
      setNotice('Venta registrada. Gracias por tu compra.')
      setCartOpen(false)
      const refreshed = await request<Product[]>('/productos/')
      setProducts(refreshed)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Eva Store inicio">
          <span className="brand-mark">E</span>
          <span><strong>eva</strong><small>STORE</small></span>
        </a>
        <nav className="nav-links" aria-label="Navegación principal">
          <a href="#catalogo">Catálogo</a>
          <a href="#nosotros">Nosotros</a>
        </nav>
        <div className="header-actions">
          <button className="icon-button" onClick={() => setLoginOpen(true)} aria-label="Iniciar sesión">
            <span>♙</span>
          </button>
          <button className="cart-button" onClick={() => setCartOpen(true)}>
            <span>Carrito</span><b>{cartCount}</b>
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">NUEVA COLECCIÓN · 2025</p>
            <h1>Tu estilo.<br /><em>Tu momento.</em></h1>
            <p className="hero-description">Piezas pensadas para acompañarte todos los días. Diseño consciente, materiales nobles y mucha personalidad.</p>
            <a className="primary-button" href="#catalogo">Explorar colección <span>→</span></a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="sun"></div><div className="arch"></div>
            <div className="model-shape"></div><div className="plant plant-one"></div><div className="plant plant-two"></div>
            <span className="hero-tag">EVA / 03</span>
          </div>
        </section>

        <section className="trust-row">
          <span><b>✦</b> Diseño local</span><span><b>◌</b> Envíos a todo Chile</span><span><b>♡</b> Hecho para durar</span>
        </section>

        <section className="catalog-section" id="catalogo">
          <div className="section-heading">
            <div><p className="eyebrow">PARA TI</p><h2>Descubre tu próxima<br /><em>pieza favorita.</em></h2></div>
            <div className="search-wrap"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos..." aria-label="Buscar productos" /></div>
          </div>
          {error && <div className="alert" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
          {notice && <div className="toast" role="status">{notice}</div>}
          {loading && <div className="state-message">Cargando la colección...</div>}
          {!loading && !error && visibleProducts.length === 0 && <div className="state-message">No encontramos productos con esa búsqueda.</div>}
          <div className="product-grid">
            {visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} onAdd={addToCart} />)}
          </div>
        </section>

        <section className="manifesto" id="nosotros">
          <p className="eyebrow">EVA / ESTUDIO</p><h2>Menos, pero<br /><em>mejor.</em></h2>
          <p>Creemos en comprar menos y elegir mejor. Cada pieza nace de una intención: durar, combinar y sentirse propia.</p>
        </section>
      </main>

      <footer><span>© 2025 EVA STORE</span><span>Hecho con intención.</span><span>Instagram · Contacto</span></footer>

      {cartOpen && <CartDrawer cart={cart} total={cartTotal} rut={customerRut} setRut={setCustomerRut} onClose={() => setCartOpen(false)} onUpdate={updateQuantity} onCheckout={checkout} busy={busy} authenticated={Boolean(tokens)} />}
      {loginOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLoginOpen(false)}><form className="login-card" onSubmit={signIn}><button type="button" className="close-button" onClick={() => setLoginOpen(false)}>×</button><p className="eyebrow">ACCESO EVA</p><h2>Inicia sesión</h2><p>Necesitas una cuenta para registrar una venta.</p><label>Usuario<input required value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} /></label><label>Contraseña<input required type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label><button className="primary-button full" disabled={busy}>{busy ? 'Ingresando...' : 'Entrar'}</button></form></div>}
    </div>
  )
}

function ProductCard({ product, index, onAdd }: { product: Product; index: number; onAdd: (product: Product, size?: Size) => void }) {
  const [selectedSize, setSelectedSize] = useState<Size | undefined>(product.tallas[0])
  const available = selectedSize?.stock ?? product.stock
  return <article className={`product-card tone-${index % 4}`}>
    <div className="product-image"><span className="product-number">0{index + 1}</span><div className="product-blob"></div><span className="product-label">{product.nombre.slice(0, 1)}</span>{!product.activo && <span className="sold-out">Agotado</span>}</div>
    <div className="product-info"><div><h3>{product.nombre}</h3><p>{product.descripcion || 'Diseño esencial para todos los días.'}</p></div><strong>{formatPrice(product.precio)}</strong></div>
    {product.tallas.length > 0 && <div className="size-list" aria-label="Seleccionar talla">{product.tallas.map((size) => <button className={selectedSize?.id === size.id ? 'selected' : ''} disabled={size.stock === 0} onClick={() => setSelectedSize(size)} key={size.id}>{size.talla}</button>)}</div>}
    <button className="add-button" disabled={!product.activo || available === 0} onClick={() => onAdd(product, selectedSize)}>{available === 0 ? 'Sin stock' : 'Agregar al carrito'} <span>+</span></button>
  </article>
}

function CartDrawer({ cart, total, rut, setRut, onClose, onUpdate, onCheckout, busy, authenticated }: { cart: CartItem[]; total: number; rut: string; setRut: (value: string) => void; onClose: () => void; onUpdate: (key: string, amount: number) => void; onCheckout: () => void; busy: boolean; authenticated: boolean }) {
  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="cart-drawer"><div className="drawer-heading"><div><p className="eyebrow">TU SELECCIÓN</p><h2>Carrito <span>{cart.length}</span></h2></div><button className="close-button" onClick={onClose}>×</button></div>{cart.length === 0 ? <div className="empty-cart"><span>♡</span><p>Tu carrito está esperando<br />algo especial.</p></div> : <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.key}><div className="mini-product">{item.product.nombre.slice(0, 1)}</div><div className="cart-item-copy"><strong>{item.product.nombre}</strong><small>{item.size ? `Talla ${item.size.talla}` : 'Talla única'}</small><b>{formatPrice(item.product.precio * item.quantity)}</b></div><div className="quantity"><button onClick={() => onUpdate(item.key, -1)}>−</button><span>{item.quantity}</span><button onClick={() => onUpdate(item.key, 1)}>+</button></div></div>)}</div><div className="cart-summary"><div><span>Subtotal</span><strong>{formatPrice(total)}</strong></div><small>Envío calculado al confirmar la compra.</small><label>RUT del cliente<input value={rut} onChange={(event) => setRut(event.target.value)} placeholder="12345678-9" /></label><button className="primary-button full" onClick={onCheckout} disabled={busy}>{busy ? 'Procesando...' : authenticated ? 'Confirmar compra →' : 'Inicia sesión para comprar →'}</button></div></>}</aside></div>
}

export default App
