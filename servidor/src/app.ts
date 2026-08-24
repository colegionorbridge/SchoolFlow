import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dashboardRoutes from './routes/dashboard.routes.js';
import authRoutes from './routes/auth.routes.js';
import statsRoutes from './routes/stats.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { authMiddleware } from './middleware/auth.js';
import { adminMiddleware } from './middleware/admin.js';
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

// 4. Rutas de chat takeover (protegidas + solo admin) — antes que dashboard para /tickets/:id/...
app.use('/api/tickets', authMiddleware, adminMiddleware, chatRoutes);

// 5. Rutas protegidas del dashboard (requieren JWT)
app.use('/api', authMiddleware, dashboardRoutes);

// 6. Rutas de estadísticas (protegidas)
app.use('/api', authMiddleware, statsRoutes);

// 7. Rutas de configuración (protegidas + solo admin)
app.use('/api/settings', authMiddleware, adminMiddleware, settingsRoutes);

// 8. Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err.message }, 'Error no manejado');
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;
