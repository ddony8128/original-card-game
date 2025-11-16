import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { usersService } from '../services/users';
import { HttpStatus } from '../type/status';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET!;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookieToken = (req as any).cookies?.auth_token as string | undefined;
  const authHeader = req.header('authorization') || req.header('Authorization');
  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;
  const token = cookieToken || headerToken;
  if (!token)
    return res
      .status(HttpStatus.UNAUTHORIZED)
      .json({ message: 'missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    (async () => {
      const user = await usersService.findById(payload.sub);
      if (!user)
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ message: 'invalid token' });
      (req as any).user = user; // attach
      next();
    })().catch((e) =>
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
    );
  } catch {
    return res
      .status(HttpStatus.UNAUTHORIZED)
      .json({ message: 'invalid token' });
  }
}

export function requireAuthOrInternal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';
  const secret =
    req.header('x-internal-secret') || req.header('X-Internal-Secret');
  if (INTERNAL_SECRET && secret === INTERNAL_SECRET) {
    return next();
  }
  return requireAuth(req, res, next);
}

export function requireInternal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';
  const secret =
    req.header('x-internal-secret') || req.header('X-Internal-Secret');
  if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
    return res.status(HttpStatus.FORBIDDEN).json({ message: 'forbidden' });
  }
  return next();
}
