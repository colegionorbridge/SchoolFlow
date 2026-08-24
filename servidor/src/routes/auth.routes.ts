import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { solicitarCodigo, verificarCodigo, listarAdmins } from '../controllers/auth.controller.js';

const router = Router();

const codeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  message: { error: 'Demasiados intentos. Esperá 5 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  message: { error: 'Demasiados intentos de verificación. Esperá 5 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/admins', listarAdmins);
router.post('/solicitar-codigo', codeLimiter, solicitarCodigo);
router.post('/verificar-codigo', verifyLimiter, verificarCodigo);

export default router;
