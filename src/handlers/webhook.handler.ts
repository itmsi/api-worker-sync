import axios from 'axios';
import { OutboxEvent, insertEventLog, updateEventStatus } from '../repositories/outbox.repository';
import { logger } from '../utils/logger';

export const handleWebhookEvent = async (event: OutboxEvent): Promise<void> => {
  const destination = event.destination as string;
  let httpStatus: number | null = null;
  let responseData: any = null;
  let errorMessage: string | null = null;
  let isNotified: '0' | '1' = '0';

  logger.info(
    { event_id: event.id, destination },
    '[WebhookHandler] Sending POST request to destination URL'
  );

  try {
    const response = await axios.post(destination, event.payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    httpStatus = response.status;
    responseData = response.data;
    isNotified = '1';

    logger.info(
      { event_id: event.id, status: httpStatus },
      '[WebhookHandler] Webhook request successful'
    );
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      httpStatus = err.response?.status ?? null;
      errorMessage = err.message;
      responseData = err.response?.data ?? null;
    } else {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    logger.error({ event_id: event.id, err }, '[WebhookHandler] Webhook request failed');
    throw err;
  } finally {
    // Only insert log, consumer and retry service will handle updateEventStatus
    const errorString = errorMessage ? String(errorMessage) : null;
    
    // Attempt to parse/ensure properties is an object
    let propertiesToSave = null;
    if (responseData) {
      propertiesToSave = typeof responseData === 'object' ? responseData : { data: responseData };
    }

    await insertEventLog({
      outbox_event_id: event.id,
      http_status: httpStatus ? String(httpStatus) : null,
      error: errorString,
      properties: propertiesToSave,
    });

    // Also update `is_notified` in the main table since it's the result of this webhook attempt
    // Wait, consumer or retry service will override `is_notified`? Consumer doesn't update `is_notified`, it just does:
    // `await updateEventStatus(eventId, 'SUCCESS');`
    // Since we need to persist `isNotified`, let's update it here.
    await updateEventStatus(event.id, isNotified === '1' ? 'PROCESSING' : 'FAILED', errorMessage || undefined, isNotified);
  }
};
