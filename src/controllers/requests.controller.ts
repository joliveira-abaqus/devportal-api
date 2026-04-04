import { Request, Response, NextFunction } from 'express';
import {
  listRequests,
  getRequestById,
  createRequest,
  updateRequest,
} from '../services/request.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await listRequests(cursor, limit);
    res.json({ data: result.data, nextCursor: result.nextCursor });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const request = await getRequestById(id);
    res.json({ data: request });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, description, type, attachmentS3 } = req.body;
    const authorId = req.user!.userId;
    const request = await createRequest({ title, description, type, authorId, attachmentS3 });
    res.status(201).json({ data: request });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, prUrl } = req.body;
    const id = req.params.id as string;
    const request = await updateRequest(id, { status, prUrl });
    res.json({ data: request });
  } catch (error) {
    next(error);
  }
}
