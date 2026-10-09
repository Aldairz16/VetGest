# Despliegue: Supabase + Render

- **Supabase**: solo como PostgreSQL gestionado. El backend se conecta con `DATABASE_URL`; no se usa Supabase Auth ni la Data API.
- **Render**: `vetgest-api` (Docker, FastAPI) y `vetgest-web` (sitio estático). El sitio reenvía `/api/*` a la API para que la cookie de sesión sea del mismo origen.
- Definido en [`render.yaml`](../render.yaml). Los secretos se cargan en el panel de Render, nunca en el repositorio.

## 1. Supabase

1. En el proyecto, ve a **Connect → Session pooler** y copia la URL (puerto **5432**). Usa el *pooler* y no la conexión directa: la directa es solo IPv6 y Render no la alcanza en el plan gratuito. No uses el *transaction pooler* (6543): rompe las sentencias preparadas de psycopg.
2. Sustituye `[YOUR-PASSWORD]` por la contraseña de la base de datos. El backend acepta `postgresql://…` y añade el driver automáticamente.
3. No necesitas `NEXT_PUBLIC_SUPABASE_URL` ni la clave *publishable*: son para clientes que hablan directo con Supabase y VetGest no lo hace.

> **Seguridad.** Supabase publica el esquema `public` en su Data API usando claves públicas. En cada arranque, la API activa RLS sin políticas y revoca los permisos de `anon` y `authenticated` en todas las tablas (`lock_down_data_api` en `app/seed.py`). Verifica en **Table Editor** que todas las tablas muestran «RLS enabled». Opcional: desactiva la Data API en **Settings → API**.

## 2. Render

1. **New → Blueprint** → selecciona el repositorio y la rama.
2. Completa las variables `sync: false`:
   - `DATABASE_URL`: la URL de Supabase del paso 1.
   - `CORS_ORIGINS`: `["https://<tu-web>.onrender.com"]`, con la URL exacta del sitio, sin barra final.
   - `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`: el primer administrador de plataforma. Contraseña de al menos 12 caracteres; se pedirá cambiarla al ingresar. El correo debe tener un dominio real (no `.local`).
3. Si Render asigna a la API un dominio distinto de `vetgest-api.onrender.com`, actualiza el `destination` de la regla `/api/*` en `render.yaml` (o en **Redirects/Rewrites** del sitio).
4. Al iniciar, la API ejecuta `alembic upgrade head`, bloquea la Data API, crea el admin si no existe y arranca.

## 3. Verificación después de desplegar

1. `https://<tu-web>/api/health` → `{"status":"ok","database":"postgresql"}`.
2. Inicia sesión con el admin de arranque, cambia la contraseña y da de alta una clínica.
3. Inicia sesión como el administrador de esa clínica, crea un veterinario y un recepcionista, y publica servicios.
4. Registra un propietario, solicita una cita, confírmala desde recepción y regístrala como atendida desde el veterinario.
5. **Comprueba que la sesión se mantiene al recargar.** Render documenta que una regla *rewrite* puede apuntar a una URL externa, pero no detalla cómo trata cookies y métodos POST. Si el login responde 200 pero `/api/auth/me` devuelve 401, despliega la web como Docker con el Nginx del proyecto (plan B: `proxy_pass` hacia la URL de la API).

## Limitaciones del plan gratuito

- La API se suspende tras ~15 minutos sin tráfico; la primera petición tarda ~1 minuto.
- Supabase free pausa proyectos inactivos una semana. Haz copias de seguridad antes de datos reales (Supabase → Database → Backups o `pg_dump`).
