import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.esAdmin) {
    return res.status(403).json({ error: 'Se requiere permiso de administrador' });
  }
  next();
}
