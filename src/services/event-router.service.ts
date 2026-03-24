import { OutboxEvent } from '../repositories/outbox.repository';
import { handleCustomerEvent } from '../handlers/customer.handler';
import { handleVendorEvent } from '../handlers/vendor.handler';
import { handleWebhookEvent } from '../handlers/webhook.handler';
import { logger } from '../utils/logger';

type HandlerFn = (event: OutboxEvent) => Promise<void>;

const handlerRegistry: Record<string, HandlerFn> = {
  customer: handleCustomerEvent,
  vendor: handleVendorEvent,
  webhook: handleWebhookEvent,
};

export const routeEvent = async (event: OutboxEvent): Promise<void> => {
  const handler = handlerRegistry[event.aggregate_type.toLowerCase()];

  if (!handler) {
    logger.warn(
      { event_id: event.id, aggregate_type: event.aggregate_type },
      '[Router] No handler registered for this aggregate_type. Skipping.'
    );
    return;
  }

  await handler(event);
};
