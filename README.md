# bot-norbridge

Bot de WhatsApp para la gestión de tickets técnicos del sector IT del Colegio Norbridge. Los docentes y personal reportan incidencias informáticas por WhatsApp y el equipo de IT las gestiona desde un dashboard web.

---

## Descripción del negocio

Sistema de tickets técnicos interno del Colegio Norbridge. El personal (docentes, preceptores, administrativos, mantenimiento, directivos) reporta incidencias de soporte IT vía WhatsApp. El bot interpreta el mensaje en lenguaje natural con IA (Groq) y genera el ticket; el equipo de IT lo gestiona desde un panel web.

---

## Modelo de datos

### usuarios
| Campo | Tipo | Descripción |
|-------|------|-------------|
| telefono | PK string | Teléfono del usuario |
| nombreCompleto | string | Nombre y apellido |
| email | string | Correo institucional (único) |
| roleId | int FK | Rol al que pertenece |
| activo | boolean | Si está activo |
| esAdmin | boolean | Si puede ver el dashboard |
| registroCompleto | boolean | Si terminó el registro |
| pasoRegistro | int | Paso actual del registro |
| context | JSON | Datos temporales (historialConversacion, pendienteConfirmacion, procesando, registro) |

### roles
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| nombre | string | Nombre del rol (Docente, Preceptor, Directivo, Admin…) |
| codigoAcceso | string null | Código requerido. NULL = cualquiera puede unirse |

### sectores
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| nombre | string | Nombre del sector (Inicial, Primaria, Secundaria, Multi Sector) |
| codigoAcceso | string | Código para registrarse en este sector |

### usuarios_sectores (muchos a muchos)
| Campo | Tipo |
|-------|------|
| userTelefono | string FK |
| sectorId | int FK |

### tickets
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| asunto | string | Asunto del ticket |
| descripcion | string | Descripción |
| ubicacion | string | Ubicación (SECTOR - lugar) |
| estado | enum | abierto / en_proceso / cerrado |
| prioridad | enum | baja / media / alta |
| origen | enum | whatsapp / manual |
| userTelefono | string FK null | Quién lo creó (NULL en tickets manuales) |
| historial | JSON | Notas y timestamps del ticket |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Base de datos | PostgreSQL + Sequelize |
| Bot WhatsApp | whatsapp-web.js + Puppeteer (WhatsApp Web, no oficial) |
| IA | Groq (`qwen/qwen3.6-27b`, NLP completo en JSON mode) |
| Tiempo real | Socket.IO |
| Contenedores | Docker & Docker Compose |

### Simulación de comportamiento humano (anti-detección)

| Mecanismo | Implementación |
|---|---|
| **Typing indicator** | Inyección directa vía `client.pupPage.evaluate()` con `WAWebChatStateBridge.sendChatStateComposing()`. Delay proporcional: `1500 + texto.length * 12 + random(0-2000)` ms |
| **Rate limit** | Máximo 1 mensaje saliente cada 2 segundos por usuario (`whatsapp.ts`) |
| **Deduplicación** | `Set<string>` con TTL 15s (`handler.ts`) |
| **Read receipts** | — |
| **Botones** | Texto con números (`*1.*`, `*2.*`) + parseo numérico (los `Buttons`/`List` nativos están deprecados por WhatsApp) |

---

## Estructura del proyecto

```
bot-norbridge/
├── .opencode/
│   └── tasks.md               # Seguimiento de tareas
├── cliente/                   # Frontend React (Vite + TypeScript)
│   └── src/
│       ├── components/
│       │   ├── Dashboard/     # Panel principal + paneles (usuarios, sectores, roles, stats)
│       │   ├── Login/         # Login con contraseña
│       │   └── TicketModal/   # Detalle de ticket
│       ├── context/DataContext.tsx  # Estado global + eventos socket
│       ├── routes/AppRoutes.tsx
│       └── socket.ts          # Socket.IO client
├── servidor/
│   ├── src/
│   │   ├── app.ts             # Express entry point
│   │   ├── index.ts           # Bootstrap (DB sync + bot + server)
│   │   ├── bot/               # Lógica del bot WhatsApp
│   │   │   ├── whatsapp.ts    # Init cliente + eventos + typing/rate limit
│   │   │   ├── handler.ts     # Router principal de mensajes
│   │   │   ├── registro.ts    # Flujo de registro (nombre → sector → código → correo → rol)
│   │   │   ├── commands.ts    # Comandos directos (/tickets, /cerrar, etc.)
│   │   │   ├── actions.ts     # Ejecución de acciones (crear/cerrar/comentar)
│   │   │   └── groq.ts        # IA: NLP completo (asunto/descripción/ubicación/acción)
│   │   ├── config/database.ts # Conexión Sequelize
│   │   ├── controllers/       # dashboard.controller + stats.controller
│   │   ├── middleware/auth.ts # JWT
│   │   ├── models/            # Role, Sector, UserSector, User, Ticket
│   │   ├── routes/            # auth, dashboard, stats
│   │   ├── socket/server.ts   # Socket.IO server
│   │   └── seed.ts            # Seed de roles y sectores
│   ├── Dockerfile
│   ├── docker-compose.yml     # chatbot + db
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── .gitignore
└── README.md
```

---

## Flujo de registro (bot)

1. Usuario envía cualquier mensaje por primera vez
2. Bot pide **Nombre y Apellido**
3. Lista los **sectores** con números → elige uno
4. Pide el **código de acceso del sector**
5. Pide el **correo institucional** (`@colegionorbridge.edu.ar`)
6. Lista los **roles** → elige uno
7. Si el rol requiere código (ej: Directivo, Admin), lo pide
8. 🎉 Registro completo

**El rol define los permisos; algunos roles requieren un código de autorización extra.**

## Flujo de creación de ticket (bot, con IA)

1. El usuario escribe su problema en lenguaje natural ("no anda el proyector del aula teros")
2. La IA (Groq) interpreta el mensaje en contexto multi-turno: pide sector/ubicación específica si falta
3. Extrae `asunto`, `descripcion`, `ubicacion` y propone la acción (crear ticket)
4. El bot muestra un resumen y pide confirmación (**SI** / **NO**)
5. Confirmado → crea el ticket y lo emite por Socket.IO al dashboard

## Comandos disponibles (sin IA, ahorran tokens)

| Comando | Descripción |
|---------|-------------|
| `/tickets` | Ver tickets activos |
| `/todos` | Ver todos los tickets (incluye cerrados) |
| `/estado [id]` | Ver estado de un ticket |
| `/comentarios [id]` | Ver historial de un ticket |
| `/cerrar [id]` | Cerrar un ticket |
| `/ayuda` | Mostrar lista de comandos |

También en lenguaje natural: "se arregló" / "ya funciona" para cerrar, "ticket #N [comentario]" para comentar, etc.

---

## Mapa de rutas (API)

### Auth (público)
| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/auth/login | Login con contraseña (`ADMIN_PASSWORD`) → JWT 8h |
| GET | /api/auth/verify | Verifica token JWT |

### Dashboard (requiere JWT)
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/tickets | Listar tickets |
| POST | /api/tickets | Crear ticket manual |
| PATCH | /api/tickets/:id | Actualizar ticket (estado, prioridad, nota) + notificación WhatsApp |
| GET | /api/usuarios | Listar usuarios |
| PATCH | /api/usuarios/:telefono | Actualizar usuario (nombre, email, rol, sectores) |
| GET | /api/roles | Listar roles |
| POST | /api/roles | Crear rol |
| PATCH | /api/roles/:id | Actualizar rol |
| DELETE | /api/roles/:id | Eliminar rol |
| GET | /api/sectores | Listar sectores |
| POST | /api/sectores | Crear sector |
| PATCH | /api/sectores/:id | Actualizar sector |
| DELETE | /api/sectores/:id | Eliminar sector |

### Estadísticas (requiere JWT)
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/stats/resumen | Totales (total, abiertos, en_proceso, cerrados, alta prioridad, usuarios) |
| GET | /api/stats/por-sector | Tickets agrupados por sector |
| GET | /api/stats/por-mes | Tickets agrupados por mes |
| GET | /api/stats/usuarios-top | Usuarios con más tickets |

---

## Variables de entorno (servidor/.env)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `PORT` | Puerto del servidor (4001) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Secreto para firmar JWT |
| `ADMIN_PASSWORD` | Clave maestra de acceso al dashboard |
| `GROQ_API_KEY` | API key de Groq (IA NLP) |
| `FRONTEND_URL` | Dominio del frontend para CORS |

---

## Backup de base de datos

La base de datos corre en el contenedor Docker `bot-norbridge-db` (PostgreSQL 16, base/usuario/contraseña `norbridge`). Backups lógicos con `pg_dump`, sin detener el servicio.

### Crear backup

```bash
mkdir -p /home/tic/backups/norbridge

# Formato binario comprimido (para restaurar con pg_restore)
docker exec bot-norbridge-db pg_dump -U norbridge -d norbridge -Fc -Z9 -f /tmp/norbridge.dump
docker cp bot-norbridge-db:/tmp/norbridge.dump /home/tic/backups/norbridge/norbridge-$(date +%F).dump

# SQL plano legible (para inspección/diff)
docker exec bot-norbridge-db pg_dump -U norbridge -d norbridge --clean --if-exists --no-owner -f /tmp/norbridge.sql
docker cp bot-norbridge-db:/tmp/norbridge.sql /home/tic/backups/norbridge/norbridge-$(date +%F).sql

docker exec bot-norbridge-db rm /tmp/norbridge.dump /tmp/norbridge.sql
```

### Verificar backup

```bash
# El binario debe empezar con "PGDMP"
head -c 5 /home/tic/backups/norbridge/norbridge-<fecha>.dump
# El SQL debe listar las 5 tablas
grep -E 'CREATE TABLE' /home/tic/backups/norbridge/norbridge-<fecha>.sql
```

### Restaurar

```bash
# Binario
docker exec -i bot-norbridge-db pg_restore -U norbridge -d norbridge --clean --if-exists < /home/tic/backups/norbridge/norbridge-<fecha>.dump

# SQL plano
docker exec -i bot-norbridge-db psql -U norbridge -d norbridge < /home/tic/backups/norbridge/norbridge-<fecha>.sql
```

---

## Inicio rápido (desarrollo local)

```bash
# 1. Instalar dependencias
cd servidor && npm install
cd ../cliente && npm install

# 2. Configurar variables de entorno
cp servidor/.env.example servidor/.env
# Editar .env con las credenciales

# 3. Levantar servicios
cd servidor && docker compose up -d

# 4. Seed de datos iniciales (roles y sectores)
cd servidor && npm run seed

# 5. Iniciar backend
cd servidor && npm run dev

# 6. Iniciar frontend
cd cliente && npm run dev
```

---

## Deploy (Docker)

```bash
cd servidor
docker compose up --build -d
```

---

## Plan de mejoras — paridad con bot-dgcatra

> Estado: **planificado** (2026-08-21). Ver `.opencode/tasks.md` para el detalle y seguimiento.

Se va a portar la arquitectura y las mejoras de **bot-dgcatra** a este proyecto, manteniendo **intacta la IA** (Groq NLP multi-turno) y el **modelo de dominio** (roles/sectores, sin "bases").

### Resumen del alcance (secciones A–F)

| Sección | Área | Cambios |
|---------|------|---------|
| A | Infraestructura/seguridad | pino logger, helmet, rate-limit, graceful shutdown, reconexión del bot, Socket.IO con JWT, config centralizado, settings runtime, credenciales DB externalizadas, README |
| B | Modelo de datos | Modelo `Conversacion` (historial persistido), `User.chatId`, `Ticket.tecnicoAsignado` + `Ticket.solucion` |
| C | Bot (anti-detección/resiliencia) | Cola FIFO por usuario, `sendSeen()`, manejo multimedia, `session.ts` (caché LRU), `schemas.ts` (Zod) + tests, `helpers.ts`, `enviar.ts` unificado, `historial.ts` |
| D | Chat takeover | `chat.controller` + `chat.routes`, `context.chatConAdmin`, endpoint conversación |
| E | Controllers/routes/tickets | Dividir monolito, middleware admin/superAdmin, paginación/búsqueda/orden server-side, blacklist |
| F | Frontend | Login OTP + código maestro, layout multipágina, TicketDetail con chat, componentes, useSocket con sonidos, página Configuración |

### Decisiones confirmadas

- **Login**: portar OTP por WhatsApp + código maestro (multi-admin con superAdmin).
- **Frontend**: migrar a layout multipágina (sidebar + páginas), igual a dgcatra.
- **Chat takeover**: portar completo.
- **Dominio**: mantener roles de norbridge (no migrar a `Sector.isAdmin`).

### Punto de retorno

Antes de empezar se hizo un **backup lógico de la DB** (ver sección "Backup") y un **commit checkpoint** con tag `pre-paridad` en `main`.
