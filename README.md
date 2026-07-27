# taxationsmart · Gestión de Reporte

Aplicación web (frontend + backend + base de datos + login) que reemplaza la
herramienta local en Excel/Access descrita en `Requerimiento_BD`. Permite
consultar, de forma centralizada, expedientes, documentos, notificaciones,
guías de envío y liquidaciones oficiales de la Alcaldía de Valledupar.

## Stack

- **Frontend + Backend**: Next.js 14 (App Router) + TypeScript — un solo
  proyecto, ideal para desplegar en Vercel.
- **Base de datos**: PostgreSQL, vía **Prisma ORM**.
- **Login**: NextAuth (usuario/contraseña, sesión JWT), rutas y API
  protegidas por middleware.
- **Modelo de datos**: implementa las fuentes 6.1–6.7 del requerimiento
  (Expedientes, DocumentoExpediente, NotificacionesDocumentos,
  LiquidacionesOficiales, NotificacionesLiquidaciones, TipoDocumento,
  EmpresaMensajeria), conservando como texto los campos con ceros iniciales
  (regla 11.1).

## Estructura

```
src/
  app/
    login/page.tsx              Pantalla de ingreso
    dashboard/                  Módulo protegido (requiere sesión)
    api/
      auth/[...nextauth]/       Login (NextAuth)
      expedientes/              Buscar expedientes + documentos + notificaciones
      liquidaciones/            Buscar liquidaciones + notificaciones
  components/                   UI: pestañas, tablas, trazabilidad
  lib/                          Prisma client + configuración de auth
prisma/
  schema.prisma                 Modelo de datos
  seed.ts                       Usuario admin + datos de ejemplo (sección 18)
```

## 1. Poner en marcha en local

Requisitos: Node.js 18+, una base de datos PostgreSQL (puede ser local,
Docker, o gratuita en [Neon](https://neon.tech) / [Supabase](https://supabase.com)).

```bash
npm install
cp .env.example .env          # edita DATABASE_URL y NEXTAUTH_SECRET
npx prisma migrate dev --name init
npm run seed                  # crea el usuario admin y datos de ejemplo
npm run dev
```

Abre `http://localhost:3000` → te redirige a `/login`.

**Usuario de prueba** (creado por el seed):
- Usuario: `admin`
- Contraseña: `Valledupar2026*`

> Cámbiala en `prisma/seed.ts` antes de sembrar datos reales, o crea usuarios
> adicionales directamente en la tabla `User` (la contraseña se guarda con
> bcrypt, nunca en texto plano).

## 2. Subir el proyecto a GitHub

Este directorio ya es un repositorio Git local con el primer commit hecho.
Solo falta conectarlo a tu cuenta:

```bash
git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
git branch -M main
git push -u origin main
```

(Crea el repositorio vacío primero en github.com → "New repository", sin
README ni licencia, para evitar conflictos al hacer push.)

## 3. Desplegar en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el
   repositorio que acabas de subir.
2. En **Environment Variables**, agrega:
   - `DATABASE_URL` → la cadena de conexión de tu Postgres de producción.
     La forma más simple: en el mismo proyecto de Vercel ve a **Storage →
     Create Database → Postgres** (Neon integrado) y copia la variable que
     genera automáticamente.
   - `NEXTAUTH_SECRET` → genera uno con `openssl rand -base64 32`.
   - `NEXTAUTH_URL` → normalmente no hace falta en Vercel (se autodetecta),
     pero puedes fijarla igual a la URL pública del despliegue si lo prefieres.
3. Antes del primer despliegue (o desde tu máquina, apuntando a la base de
   datos de producción), corre las migraciones y el seed:
   ```bash
   DATABASE_URL="<misma url de producción>" npx prisma migrate deploy
   DATABASE_URL="<misma url de producción>" npm run seed
   ```
4. Haz clic en **Deploy**. Vercel ejecuta `npm run build`, que incluye
   `prisma generate` automáticamente (ver script `build` en `package.json`).

Cada nuevo `git push` a `main` vuelve a desplegar automáticamente.

## 4. Después de desplegar

- Cambia la contraseña del usuario `admin` (o crea usuarios reales) antes de
  dar acceso a los operadores.
- Reemplaza los datos de ejemplo del seed por una carga real desde las
  tablas oficiales de la plataforma (sección 19 del requerimiento) — puedes
  escribir un script de carga en `prisma/` que use `prisma.expediente.createMany`,
  etc., leyendo desde tu fuente oficial (export CSV, otra base de datos, o API).
- Los endpoints de auditoría ya registran cada consulta en la tabla
  `ConsultaAuditoria` (usuario, fecha, criterio, tipo) — sección 15.2.

## Nota sobre este entorno de construcción

Este proyecto se escribió y revisó en un entorno sin salida a Internet hacia
el CDN de motores de Prisma (`binaries.prisma.sh`), así que `prisma generate`
no pudo ejecutarse completo aquí para una compilación end-to-end. Es un paso
estándar que funcionará sin problema en tu máquina o en Vercel (ambos tienen
acceso normal a Internet); si al correr `npm install` o `npm run build` ves
algún error puntual de esa naturaleza, avísame y lo ajustamos.
