import { Request, Response, NextFunction } from 'express';
import { getSession } from '@auth/express';
import { authConfig } from './config.ts';
import { getUserById, User } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: User;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req, authConfig);
    
    if (!session || !session.user || !session.user.id) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid session' });
    }

    const user = getUserById(session.user.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Session error' });
  }
}

export function requireRole(roles: ('admin' | 'developer' | 'user')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
}
