import { Router, Request, Response, NextFunction } from 'express';
import { getOutboxEvents, getOutboxEventWithLogs, EventStatus } from '../repositories/outbox.repository';

const router = Router();

/**
 * @swagger
 * /outbox:
 *   get:
 *     summary: Get list of outbox events
 *     description: Retrieve outbox events with optional filtering and pagination.
 *     tags: [Outbox]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: aggregate_type
 *         schema:
 *           type: string
 *         description: Filter by module/aggregate type (e.g. customer)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [WAITING, PROCESSING, SUCCESS, FAILED]
 *         description: Filter by event status
 *       - in: query
 *         name: is_notified
 *         schema:
 *           type: string
 *           enum: ['0', '1']
 *         description: Filter by webhook notification status ('0' = failed, '1' = success)
 *     responses:
 *       200:
 *         description: A paginated list of outbox events
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);
    
    const filters: { aggregate_type?: string; status?: EventStatus; is_notified?: '0' | '1' } = {};
    if (req.query.aggregate_type) filters.aggregate_type = req.query.aggregate_type as string;
    if (req.query.status) filters.status = req.query.status as EventStatus;
    if (req.query.is_notified) filters.is_notified = req.query.is_notified as '0' | '1';

    const result = await getOutboxEvents(page, limit, filters);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /outbox/{event_id}:
 *   get:
 *     summary: Get outbox event details with logs
 *     description: Retrieve a specific outbox event by ID along with its execution logs to troubleshoot failures.
 *     tags: [Outbox]
 *     parameters:
 *       - in: path
 *         name: event_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the outbox event
 *     responses:
 *       200:
 *         description: Event details and an array of logs
 *       404:
 *         description: Event not found
 */
router.get('/:event_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.event_id as string;
    const data = await getOutboxEventWithLogs(eventId);
    
    if (!data) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
