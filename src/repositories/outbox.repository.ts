import { db } from '../config/db';

export type EventStatus = 'WAITING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface OutboxEvent {
  id: string;
  aggregate_type: string;
  aggregate_id: number;
  event_type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  status: EventStatus;
  retry_count: number;
  max_retry: number;
  last_error?: string;
  created_at: Date;
  updated_at: Date;
}

const TABLE = 'outbox_events';

export const findEventById = async (eventId: string): Promise<OutboxEvent | null> => {
  const row = await db<OutboxEvent>(TABLE).where({ id: eventId }).first();
  return row ?? null;
};

export const updateEventStatus = async (
  eventId: string,
  status: EventStatus,
  lastError?: string
): Promise<void> => {
  await db(TABLE).where({ id: eventId }).update({
    status,
    last_error: lastError ?? undefined,
    updated_at: db.fn.now(),
  });
};

export const incrementRetryCount = async (eventId: string): Promise<void> => {
  await db(TABLE).where({ id: eventId }).update({
    retry_count: db.raw('retry_count + 1'),
    updated_at: db.fn.now(),
  });
};

export const resetEventForRetry = async (eventId: string): Promise<void> => {
  await db(TABLE).where({ id: eventId }).update({
    status: 'WAITING',
    retry_count: 0,
    last_error: db.raw('NULL'),
    updated_at: db.fn.now(),
  });
};

export const resetModuleEventsForRetry = async (aggregateType: string): Promise<OutboxEvent[]> => {
  const rows = await db
    .raw<{ rows: OutboxEvent[] }>(
      `UPDATE outbox_events
       SET status = 'WAITING', retry_count = 0, last_error = NULL, updated_at = NOW()
       WHERE aggregate_type = ? AND status = 'FAILED'
       RETURNING *`,
      [aggregateType]
    );
  return rows.rows;
};

export const resetBulkEventsForRetry = async (
  aggregateType?: string,
  fromDate?: string,
  toDate?: string,
  status?: EventStatus
): Promise<OutboxEvent[]> => {
  const bindings: unknown[] = [status ?? 'FAILED'];
  const conditions: string[] = ['status = ?'];

  if (aggregateType) {
    conditions.push('aggregate_type = ?');
    bindings.push(aggregateType);
  }
  if (fromDate) {
    conditions.push('created_at >= ?');
    bindings.push(fromDate);
  }
  if (toDate) {
    conditions.push('created_at <= ?');
    bindings.push(toDate);
  }

  const where = conditions.join(' AND ');
  const result = await db.raw<{ rows: OutboxEvent[] }>(
    `UPDATE outbox_events
     SET status = 'WAITING', retry_count = 0, last_error = NULL, updated_at = NOW()
     WHERE ${where}
     RETURNING *`,
    bindings
  );
  return result.rows;
};
