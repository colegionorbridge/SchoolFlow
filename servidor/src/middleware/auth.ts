import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthRequest extends Request {
  user?: { telefono?: string; esAdmin?: boolean; role?: string; superAdmin?: boolean; nombre?: string };
}

export const usuariosBaneados = new Set<string>();

export function banearUsuario(telefono: string) {
  usuariosBaneados.add(telefono);
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const token = header.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    const decoded = jwt.verify(token, config.jwt.secret) as {
      telefono?: string;
      esAdmin?: boolean;
      role?: string;
      superAdmin?: boolean;
      nombre?: string;
    };
    if (decoded.telefono && usuariosBaneados.has(decoded.telefono)) {
      return res.status(401).json({ error: 'Usuario eliminado. Debe registrarse nuevamente.' });
    }
    req.user = {
      telefono: decoded.telefono,
      esAdmin: decoded.esAdmin ?? decoded.role === 'admin',
      role: decoded.role,
      superAdmin: decoded.superAdmin,
      nombre: decoded.nombre,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
