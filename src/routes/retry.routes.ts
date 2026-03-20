import { Router, Request, Response, NextFunction } from 'express';
import {
  manualRetrySingle,
  manualRetryByModule,
  manualRetryBulk,
} from '../services/retry.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /retry/module/:type
 * Must be defined BEFORE /retry/:event_id to avoid route conflict
 * Retry all FAILED events for a specific module (e.g., customer, vendor)
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
 * POST /retry/bulk
 * Retry bulk events with optional filters
 * Body: { aggregate_type?, from_date?, to_date?, status? }
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
 * POST /retry/:event_id
 * Retry a single failed event
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
