import { OutboxEvent } from '../repositories/outbox.repository';
import { logger } from '../utils/logger';

/**
 * Vendor Handler — Template (not yet implemented)
 * Add business logic here when the vendor module is ready.
 */
export const handleVendorEvent = async (event: OutboxEvent): Promise<void> => {
  logger.warn(
    { event_id: event.id, aggregate_type: event.aggregate_type },
    '[VendorHandler] Vendor handler is not yet implemented. Skipping event.'
  );
};
