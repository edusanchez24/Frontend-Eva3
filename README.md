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

## Vercel

Configura el **Root Directory** del proyecto de Vercel como `Frontend-Eva3` y
define `VITE_API_URL` en las variables de entorno de producción apuntando a la
URL pública de Django, por ejemplo `https://tu-api.vercel.app/api`. El archivo
`vercel.json` de esta carpeta publica el build de Vite; el `vercel.json` en
`CatalogoVentas_Eva3` corresponde únicamente a la API.

## Comandos

- `npm run build`: valida TypeScript y genera la versión de producción.
- `npm run lint`: ejecuta ESLint.
