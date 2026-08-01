# Infraestructura y forma de trabajo en la web

Cómo se organiza el desarrollo para no tener problemas después: propiedad de
las cuentas, entornos, deploys, secretos, backups y costos.

## 1. Propiedad — todo a nombre del dueño

Todas las cuentas se crean con el mail del dueño de MTHosting, desde el día
cero:

| Servicio | Para qué | Plan inicial |
|---|---|---|
| GitHub | Repositorio privado del código | Free |
| Supabase | Base de datos, auth, storage | Free (dev) → Pro en producción |
| Vercel | Hosting y deploys | Hobby (dev) → Pro en producción |
| Dominio | ej. `gestion.mthosting.com` | ~USD 15/año |

Si alguna vez trabaja otra persona, entra como colaborador invitado. El
proyecto nunca vive en la cuenta de un tercero.

## 2. Un repositorio, esta estructura

```
mthosting/
├── CLAUDE.md               ← convenciones (Claude Code lo lee siempre)
├── docs/                   ← especificaciones y plan
├── supabase/
│   └── migrations/         ← ÚNICA forma de cambiar el esquema
├── app/                    ← Next.js App Router
├── lib/                    ← utilidades (fechas AR, parser, tarifas)
└── .env.local              ← secretos locales, GITIGNORED
```

## 3. Dos entornos, nunca uno

**Regla de oro: jamás desarrollar contra la base de producción.**

- `mthosting-dev` — proyecto Supabase gratuito. Acá se desarrolla y se rompe.
- `mthosting-prod` — proyecto Supabase separado. Solo recibe migraciones ya
  probadas en dev.

Las migraciones son archivos SQL en `supabase/migrations/`, aplicados con la
CLI a dev primero y a prod después. **Prohibido tocar el esquema desde el
panel web de Supabase**: un cambio hecho a mano no queda registrado, no se
puede reproducir y tarde o temprano desincroniza los dos entornos.

## 4. Flujo de trabajo diario

```
código local → commit → push a GitHub → Vercel despliega solo
```

- La rama `main` es producción: cada push a main publica automáticamente.
- Para cambios grandes: rama aparte → Vercel genera una **URL de preview**
  automática (sirve para mostrarle algo a Maguie antes de publicarlo) →
  merge a main cuando está aprobado.
- Commit cada vez que algo queda funcionando. Es la red de seguridad para
  volver atrás cuando algo se rompe.

## 5. Secretos

- `.env.local` en la máquina, nunca commiteado (verificar `.gitignore` el
  primer día).
- En Vercel, las variables de entorno se cargan por entorno (preview /
  production) desde su panel.
- La clave `service_role` de Supabase da acceso total saltando los permisos:
  vive SOLO en el servidor. Si alguna vez aparece en el código del navegador
  o en un commit, se rota inmediatamente.
- Las credenciales de Airbnb de los propietarios van cifradas en la base,
  nunca en texto plano (hoy en Ninox están en texto plano: eso no se replica).

## 6. Backups

- Al pasar a producción, Supabase Pro incluye backups diarios automáticos.
- Adicional: un export semanal (`pg_dump` o el export del panel) guardado
  fuera de Supabase (Drive). Cuesta 5 minutos y cubre el caso "borré algo y
  me di cuenta a los 20 días".
- Antes de aplicar cualquier migración en prod: backup manual. Siempre.

## 7. Dominio y PWA

- Subdominio propio (ej. `gestion.mthosting.com`) apuntado a Vercel; el SSL
  es automático.
- La app se configura como PWA instalable desde el inicio: en el celular se
  agrega a la pantalla de inicio y se abre como una app. Sin tiendas, sin
  instalación, actualizaciones instantáneas.

## 8. Costos honestos

| Etapa | Mensual aprox. |
|---|---|
| Desarrollo (Fase 1 en construcción) | USD 0 — todo en free tier |
| Producción | USD 45–50: Supabase Pro (25) + Vercel Pro (20) + dominio |

Nota sobre Vercel: el plan Hobby es gratis pero sus términos **prohíben uso
comercial**. Para desarrollar alcanza; al poner el sistema en producción real
corresponde Vercel Pro. Verificar precios vigentes al momento de contratar.

El único recurso que crece de verdad son las fotos (Fase 2): con compresión
en el cliente, ~8–10 GB/año, dentro del plan. Sin compresión, 20× más.

## 9. Escala esperada (para no sobre-construir)

| Métrica | Volumen anual |
|---|---|
| Reservas | 3.000 – 4.000 |
| Limpiezas | 5.000 – 7.000 |
| Usuarios simultáneos | 10 – 15 |

Postgres con buenos índices maneja esto sin despeinarse hasta 200+
departamentos. Lo que sí importa: índices en las columnas de filtro,
paginación en listados, y nunca el patrón "recorrer toda la tabla por cada
fila". Microservicios, colas y cachés serían complejidad pagada por nada.

## 10. Checklist del día cero

1. Crear cuenta GitHub + repo privado `mthosting`
2. Crear cuenta Supabase + proyectos `mthosting-dev` y `mthosting-prod`
3. Crear cuenta Vercel + conectar el repo
4. Instalar Supabase CLI y vincular el proyecto dev
5. Copiar `CLAUDE.md` y `docs/` al repo, primer commit
6. Verificar que `.env.local` está en `.gitignore`
7. Deploy vacío funcionando en Vercel (aunque muestre "hola")
8. Recién entonces: primera migración con el esquema completo
