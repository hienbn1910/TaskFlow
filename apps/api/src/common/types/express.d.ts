import type { AuthUser } from './auth-user.type';

/**
 * Type augmentation: tells TypeScript that Express requests may carry `user`
 * (set by JwtAuthGuard). Without it, `request.user` would need an `as` cast everywhere.
 * Type-only: produces no JavaScript.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
