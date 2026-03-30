import { Router, Request, Response, NextFunction } from 'express';
import {
  manualRetrySingle,
  manualRetryByModule,
  manualRetryBulk,
} from '../services/retry.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/webhook/retry/module/{type}:
 *   post:
 *     summary: Retry events by module
 *     description: Retries all FAILED events for a specific module (e.g., customer, vendor).
 *     tags: [Retry]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: The aggregate type (module name)
 *     responses:
 *       200:
 *         description: Successfully queued for retry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 aggregate_type:
 *                   type: string
 *                 re_queued:
 *                   type: integer
 */
router.post('/module/:type', async (req: Request, res: Response, next: NextFunction) => {
  const type = req.params['type'] as string;
  try {
    const count = await manualRetryByModule(type);
    logger.info({ aggregate_type: type, count }, '[API] Manual retry triggered for module');
    res.json({ success: true, aggregate_type: type, re_queued: count });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/webhook/retry/bulk:
 *   post:
 *     summary: Bulk retry events
 *     description: Retry bulk events with optional filters.
 *     tags: [Retry]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               aggregate_type:
 *                 type: string
 *               from_date:
 *                 type: string
 *                 format: date-time
 *               to_date:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [WAITING, PROCESSING, SUCCESS, FAILED]
 *     responses:
 *       200:
 *         description: Successfully queued for retry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 re_queued:
 *                   type: integer
 */
router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  const { aggregate_type, from_date, to_date, status } = req.body as {
    aggregate_type?: string;
    from_date?: string;
    to_date?: string;
    status?: string;
  };
  try {
    const count = await manualRetryBulk({
      aggregateType: aggregate_type,
      fromDate: from_date,
      toDate: to_date,
      status: status as 'WAITING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | undefined,
    });
    logger.info({ aggregate_type, from_date, to_date, count }, '[API] Bulk retry triggered');
    res.json({ success: true, re_queued: count });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/webhook/retry/{event_id}:
 *   post:
 *     summary: Retry single event
 *     description: Retry a single failed event by taking its ID.
 *     tags: [Retry]
 *     parameters:
 *       - in: path
 *         name: event_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The UUID of the outbox event
 *     responses:
 *       200:
 *         description: Successfully queued for retry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/:event_id', async (req: Request, res: Response, next: NextFunction) => {
  const event_id = req.params['event_id'] as string;
  try {
    await manualRetrySingle(event_id);
    logger.info({ event_id }, '[API] Manual retry triggered for single event');
    res.json({ success: true, message: `Event ${event_id} has been re-queued.` });
  } catch (err) {
    next(err);
  }
});

export default router;
