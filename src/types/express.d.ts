import { AuthPayload } from '../middleware/auth.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
