# Eva Store

Frontend React + TypeScript para el catálogo y ventas de `CatalogoVentas_Eva3`.

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación usa `http://localhost:8000/api` por defecto. Para apuntar a otra
instancia de Django, crea un archivo `.env` con:

```bash
VITE_API_URL=https://tu-api.example.com/api
```

El catálogo consume `GET /productos/`. El inicio de sesión usa `POST /token/`
y la confirmación de compra registra la venta mediante `POST /ventas/`.

## Comandos

- `npm run build`: valida TypeScript y genera la versión de producción.
- `npm run lint`: ejecuta ESLint.
