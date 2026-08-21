import { Router } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intentá de nuevo en 5 minutos.' },
});

router.post('/login', loginLimiter, async (req: any, res: any) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password requerido' });
    }

    const adminPassword = config.adminPassword;

    if (!adminPassword) {
      logger.error('ADMIN_PASSWORD no está configurado en .env');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { role: 'admin', esAdmin: true, nombre: 'Admin', exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) }, // 8 horas
      config.jwt.secret
    );

    res.json({
      success: true,
      token,
      expiresIn: 8 * 60 * 60 // 8 horas en segundos
    });

  } catch (error) {
    logger.error({ err: error }, 'Error en login');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/verify', async (req: any, res: any) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ valid: false, error: 'No autorizado' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ valid: false, error: 'Token faltante' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
  }
});

export default router;
