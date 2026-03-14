import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async Express route handler so that any rejected promise is
 * forwarded to the centralized error middleware via next(err) instead of
 * silently causing an unhandled rejection.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
