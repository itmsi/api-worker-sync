import { connectRabbitMQ } from '../config/rabbitmq';
import {
  findEventById,
  updateEventStatus,
} from '../repositories/outbox.repository';
import { routeEvent } from '../services/event-router.service';
import { handleEventFailure } from '../services/retry.service';
import { logger } from '../utils/logger';

const PREFETCH = parseInt(process.env.RABBITMQ_PREFETCH || '5', 10);

export const startConsumer = async (): Promise<void> => {
  const channel = await connectRabbitMQ();
  channel.prefetch(PREFETCH);

  logger.info(`[Consumer] Listening on queue: sync.events (prefetch: ${PREFETCH})`);

  channel.consume('sync.events', async (msg) => {
    if (!msg) return;

    let eventId: string | undefined;

    try {
      const content = JSON.parse(msg.content.toString());
      eventId = content.event_id;

      if (!eventId) {
        logger.error('[Consumer] Message missing event_id — discarding');
        channel.nack(msg, false, false);
        return;
      }

      logger.info({ eventId }, '[Consumer] Message received');

      const event = await findEventById(eventId);
      if (!event) {
        logger.warn({ eventId }, '[Consumer] Event not found in DB — discarding');
        channel.nack(msg, false, false);
        return;
      }

      // Skip if already processed
      if (event.status === 'SUCCESS') {
        logger.info({ eventId }, '[Consumer] Event already SUCCESS — skipping');
        channel.ack(msg);
        return;
      }

      await updateEventStatus(eventId, 'PROCESSING');

      await routeEvent(event);

      await updateEventStatus(eventId, 'SUCCESS');
      channel.ack(msg);
      logger.info({ eventId }, '[Consumer] Event processed successfully');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error({ eventId, err: error.message }, '[Consumer] Error processing event');

      channel.ack(msg); // ACK to remove from queue — retry handled via retry service with delay

      if (eventId) {
        await handleEventFailure(eventId, error);
      }
    }
  });
};
