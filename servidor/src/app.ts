import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dashboardRoutes from './routes/dashboard.routes.js';

const app: Application = express();

// 1. Configuración de CORS ultra-permisiva para Debug
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. Middleware para limpiar errores de CSP y forzar el paso
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline';");
  next();
});

// 3. Ruta de prueba directa (SIN router) para descartar fallos de importación
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Si ves esto, el túnel y el prefijo /api funcionan' });
});

// 4. Tus rutas modularizadas
app.use('/api', dashboardRoutes);

export default app;