# SNEAK//CTRL

Cliente React + TypeScript para el catálogo, inventario, clientes y ventas de zapatillas.

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación usa `https://backend-api-ivory-two.vercel.app` por defecto. Para apuntar a otra
instancia de Django, crea un archivo `.env` a partir de `.env.example`:

```bash
VITE_API_URL=https://tu-api.example.com
```

El cliente HTTP central incluye autenticación JWT, renovación automática del access
token y formato de errores de Django REST Framework.

## Vercel

Configura el **Root Directory** del proyecto de Vercel como `Frontend-Eva3` y
define `VITE_API_URL` en las variables de entorno de producción apuntando a la
URL pública de Django, por ejemplo `https://tu-api.vercel.app`. El archivo
`vercel.json` mantiene el rewrite de Vite a `index.html`.

## Comandos

- `npm run build`: valida TypeScript y genera la versión de producción.
- `npm run lint`: ejecuta ESLint.
