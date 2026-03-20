import { Router, Request, Response } from 'express';
import { db } from '../config/db';

const router = Router();

/**
 * GET /health
 * Returns service health status
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    await db.raw('SELECT 1');
    res.json({
      status: 'ok',
      service: 'api-worker',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      service: 'api-worker',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

export default router;
