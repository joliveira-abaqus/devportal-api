import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ZodIssue {
  path: (string | number)[];
  message: string;
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = (error.issues as ZodIssue[]).map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        res.status(400).json({
          error: {
            message: 'Erro de validação.',
            code: 'VALIDATION_ERROR',
            details: messages,
          },
        });
        return;
      }
      next(error);
    }
  };
}
