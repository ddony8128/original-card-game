import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { usersService } from '../services/users';
import { HttpStatus } from '../type/status';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET!;
const isProd = process.env.NODE_ENV === 'prod';

export const authRouter = Router();

authRouter.post('/register', (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  if (!username?.trim() || !password?.trim()) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      message: 'username and password required',
    });
  }
  (async () => {
    const exists = await usersService.findByUsername(username);
    if (exists) {
      return res.status(HttpStatus.CONFLICT).json({
        message: 'username already exists',
      });
    }

    const created = await usersService.create(username, password);

    res.status(HttpStatus.CREATED).json({
      message: 'user created',
      id: created.id,
      username: created.username,
      created_at: created.created_at,
    });
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: e.message,
    }),
  );
});

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  if (!username || !password) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      message: 'username and password required',
    });
  }
  (async () => {
    const user = await usersService.findByUsername(username);
    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message: 'invalid credentials',
      });
    }
    const ok = usersService.verifyPassword(password, user);
    if (!ok) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message: 'invalid credentials',
      });
    }
    const token = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.status(HttpStatus.OK).json({
      id: user.id,
      message: 'user logged in',
      username: user.username,
      created_at: user.created_at,
    });
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: e.message,
    }),
  );
});

authRouter.get('/me', (req, res) => {
  const cookieToken = (req as any).cookies?.auth_token as string | undefined;
  const authHeader = req.header('authorization') || req.header('Authorization');
  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;
  const token = cookieToken || headerToken;
  if (!token) {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      message: 'missing token',
    });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      username: string;
    };
    (async () => {
      const user = await usersService.findById(payload.sub);
      if (!user) {
        return res.status(HttpStatus.NOT_FOUND).json({
          message: 'user not found',
        });
      }
      return res.status(HttpStatus.OK).json({
        message: 'user found',
        id: user.id,
        username: user.username,
        created_at: user.created_at,
      });
    })().catch((e) =>
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: e.message,
      }),
    );
  } catch {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      message: 'invalid token',
    });
  }
});
