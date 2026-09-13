import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';

type Target = 'body' | 'query' | 'params';

// Valida e substitui a parte da requisição pelos dados já parseados/coeridos.
export function validate(schema: ZodSchema, target: Target = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      throw ValidationError('Invalid request data', details);
    }
    // query é readonly em alguns tipos do Express; atribui via defineProperty seguro
    (req as any)[target] = result.data;
    next();
  };
}
