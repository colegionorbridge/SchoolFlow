import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dashboardRoutes from './routes/dashboard.routes.js';
import authRoutes from './routes/auth.routes.js';
import { authMiddleware } from './middleware/auth.js';

const app: Application = express();

// 1. Configuración de CORS restrictiva
const frontendUrl = process.env.FRONTEND_URL || 'https://school-flow-inky.vercel.app';
const apiUrl = 'https://api.alejndrogcandia.online';

app.use(cors({
  origin: [frontendUrl, 'http://localhost:5173', apiUrl], // Permitir Vercel, API y desarrollo local
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// 2. Middleware para limpiar errores de CSP
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline';");
  next();
});

// 3. Ruta de prueba
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'SchoolFlow API funcionando' });
});

// 4. Rutas de autenticación (públicas)
app.use('/api/auth', authRoutes);

// 5. Rutas protegidas del dashboard (requieren JWT)
app.use('/api', authMiddleware, dashboardRoutes);

export default app;