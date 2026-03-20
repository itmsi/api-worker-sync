import axios from 'axios';
import { OutboxEvent } from '../repositories/outbox.repository';
import { createIntegrationLog } from '../repositories/integration-log.repository';
import { logger } from '../utils/logger';

export const handleCustomerEvent = async (event: OutboxEvent): Promise<void> => {
  const middlewareUrl = process.env.MIDDLEWARE_API_URL || 'http://localhost:3000';
  const endpoint = `${middlewareUrl}/api/customers`;

  const requestPayload = {
    ...event.payload,
    external_id: event.aggregate_id,
  };

  logger.info(
    { event_id: event.id, aggregate_id: event.aggregate_id, event_type: event.event_type },
    '[CustomerHandler] Sending request to Middleware API'
  );

  try {
    const response = await axios.post(endpoint, requestPayload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    await createIntegrationLog({
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      request_payload: requestPayload,
      response_payload: response.data,
      status: 'SUCCESS',
    });

    logger.info(
      { event_id: event.id, status: response.status },
      '[CustomerHandler] Request successful'
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await createIntegrationLog({
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      request_payload: requestPayload,
      status: 'FAILED',
      error_message: errorMessage,
    });

    logger.error({ event_id: event.id, err }, '[CustomerHandler] Request failed');
    throw err;
  }
};
