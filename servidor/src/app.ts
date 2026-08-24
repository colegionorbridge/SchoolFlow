import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import sectoresRoutes from './routes/sectores.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import chatRoutes from './routes/chat.routes.js';
import statsRoutes from './routes/stats.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import { config } from './config/index.js';
import { logger } from './config/logger.js';

const app: Application = express();

// 1. Configuración de CORS restrictiva
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5173',
  'https://api.alejndrogcandia.online',
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(helmet());
app.use(express.json());

// 2. Ruta de salud
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'SchoolFlow API funcionando' });
});

app.get('/health/bot', (_req, res) => {
  import('./bot/whatsapp.js').then(({ client }) => {
    const connected = !!(client as any)?.info?.wid;
    const phone = connected ? (client as any).info.wid._serialized?.split('@')[0] : null;
    res.json({ connected, phone });
  }).catch(() => res.json({ connected: false, phone: null }));
});

// 3. Rutas de autenticación (públicas)
app.use('/api/auth', authRoutes);

// 4. Rutas de chat takeover (auth + admin)
app.use('/api/tickets', chatRoutes);

// 5. Rutas de tickets (auth; PATCH admin)
app.use('/api/tickets', ticketsRoutes);

// 6. Resto de rutas protegidas (self-contained)
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/sectores', sectoresRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);

// 7. Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err.message }, 'Error no manejado');
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;
