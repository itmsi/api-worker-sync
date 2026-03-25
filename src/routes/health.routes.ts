import { Router, Request, Response } from 'express';
import { db } from '../config/db';

const router = Router();

/**
 * @swagger
 * /api/webhook/health:
 *   get:
 *     summary: Check service health
 *     description: Returns the health status of the api-worker service and its database connection.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 service:
 *                   type: string
 *                   example: api-worker
 *                 timestamp:
 *                   type: string
 *                   example: "2026-03-24T12:00:00.000Z"
 *                 database:
 *                   type: string
 *                   example: connected
 *       503:
 *         description: Service is degraded (e.g. database disconnected)
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
