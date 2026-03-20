import { Channel } from 'amqplib';
import {
  findEventById,
  updateEventStatus,
  incrementRetryCount,
  resetEventForRetry,
  resetModuleEventsForRetry,
  resetBulkEventsForRetry,
  EventStatus,
} from '../repositories/outbox.repository';
import { getRabbitMQChannel } from '../config/rabbitmq';
import { logger } from '../utils/logger';

/** Exponential backoff delays in ms: 1s, 5s, 30s, 2m, 10m */
const BACKOFF_DELAYS = [1000, 5000, 30000, 120000, 600000];

export const getBackoffDelay = (retryCount: number): number => {
  const idx = Math.min(retryCount, BACKOFF_DELAYS.length - 1);
  return BACKOFF_DELAYS[idx];
};

export const publishToQueue = (channel: Channel, eventId: string): void => {
  channel.publish(
    'sync.exchange',
    'events',
    Buffer.from(JSON.stringify({ event_id: eventId })),
    { persistent: true, contentType: 'application/json' }
  );
};

export const publishToDLQ = (channel: Channel, eventId: string): void => {
  channel.publish(
    'sync.dlx',
    'sync.dlq',
    Buffer.from(JSON.stringify({ event_id: eventId })),
    { persistent: true, contentType: 'application/json' }
  );
};

export const handleEventFailure = async (eventId: string, error: Error): Promise<void> => {
  const event = await findEventById(eventId);
  if (!event) {
    logger.error({ eventId }, '[RetryService] Event not found when handling failure');
    return;
  }

  await incrementRetryCount(eventId);
  const newRetryCount = event.retry_count + 1;

  if (newRetryCount >= event.max_retry) {
    logger.warn(
      { eventId, retryCount: newRetryCount, maxRetry: event.max_retry },
      '[RetryService] Max retries reached. Sending to DLQ.'
    );
    const channel = getRabbitMQChannel();
    publishToDLQ(channel, eventId);
    await updateEventStatus(eventId, 'FAILED', error.message);
    return;
  }

  const delay = getBackoffDelay(newRetryCount);
  logger.info(
    { eventId, retryCount: newRetryCount, delayMs: delay },
    '[RetryService] Scheduling retry with backoff'
  );

  await updateEventStatus(eventId, 'WAITING', error.message);

  setTimeout(() => {
    try {
      const channel = getRabbitMQChannel();
      publishToQueue(channel, eventId);
    } catch (err) {
      logger.error({ err, eventId }, '[RetryService] Failed to republish event after backoff');
    }
  }, delay);
};

/** Manual retry: single event */
export const manualRetrySingle = async (eventId: string): Promise<void> => {
  const event = await findEventById(eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);

  await resetEventForRetry(eventId);
  const channel = getRabbitMQChannel();
  publishToQueue(channel, eventId);
  logger.info({ eventId }, '[RetryService] Manual retry published for single event');
};

/** Manual retry: all FAILED events for a module */
export const manualRetryByModule = async (aggregateType: string): Promise<number> => {
  const events = await resetModuleEventsForRetry(aggregateType);
  const channel = getRabbitMQChannel();
  events.forEach((e) => publishToQueue(channel, e.id));
  logger.info({ aggregateType, count: events.length }, '[RetryService] Manual retry by module published');
  return events.length;
};

/** Manual retry: bulk with filters */
export const manualRetryBulk = async (params: {
  aggregateType?: string;
  fromDate?: string;
  toDate?: string;
  status?: EventStatus;
}): Promise<number> => {
  const events = await resetBulkEventsForRetry(
    params.aggregateType,
    params.fromDate,
    params.toDate,
    params.status
  );
  const channel = getRabbitMQChannel();
  events.forEach((e) => publishToQueue(channel, e.id));
  logger.info({ ...params, count: events.length }, '[RetryService] Bulk manual retry published');
  return events.length;
};
