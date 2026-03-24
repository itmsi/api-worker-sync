import { db } from '../config/db';

export type EventStatus = 'WAITING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface OutboxEvent {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  status: EventStatus;
  retry_count: number;
  max_retry: number;
  last_error?: string;
  created_at: Date;
  updated_at: Date;

  destination?: string | null;
  is_notified?: '0' | '1';
  created_by?: string | null;
  updated_by?: string | null;
  is_deleted?: boolean;
  properties?: Record<string, unknown> | null;
  app_id?: number | null;
}

export interface OutboxEventLog {
  id?: string;
  outbox_event_id: string;
  http_status?: string | null;
  error?: string | null;
  properties?: Record<string, unknown> | null;
  created_by?: string | null;
  created_at?: Date;
  updated_by?: string | null;
  updated_at?: Date;
  is_deleted?: boolean;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

const TABLE = 'outbox_events';

export const findEventById = async (eventId: string): Promise<OutboxEvent | null> => {
  const row = await db<OutboxEvent>(TABLE).where({ id: eventId }).first();
  return row ?? null;
};

export const updateEventStatus = async (
  eventId: string,
  status: EventStatus,
  lastError?: string,
  isNotified?: '0' | '1',
  destinationUrl?: string
): Promise<void> => {
  const updateData: Record<string, any> = {
    status,
    last_error: lastError ?? db.raw('NULL'),
    updated_at: db.fn.now(),
  };

  if (isNotified !== undefined) {
    updateData.is_notified = isNotified;
  }
  
  if (destinationUrl !== undefined) {
    updateData.destination = destinationUrl;
  }

  await db(TABLE).where({ id: eventId }).update(updateData);
};

export const insertEventLog = async (log: OutboxEventLog): Promise<void> => {
  await db('outbox_event_logs').insert(log);
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

export const getOutboxEvents = async (
  page: number = 1,
  limit: number = 10,
  filters: { aggregate_type?: string; status?: EventStatus; is_notified?: '0' | '1' } = {}
) => {
  const query = db<OutboxEvent>(TABLE).select('*').orderBy('created_at', 'desc');

  if (filters.aggregate_type) query.where('aggregate_type', filters.aggregate_type);
  if (filters.status) query.where('status', filters.status);
  if (filters.is_notified) query.where('is_notified', filters.is_notified);

  const offset = (page - 1) * limit;
  const rows = await query.limit(limit).offset(offset);

  const countQuery = db(TABLE).count('* as total');
  if (filters.aggregate_type) countQuery.where('aggregate_type', filters.aggregate_type);
  if (filters.status) countQuery.where('status', filters.status);
  if (filters.is_notified) countQuery.where('is_notified', filters.is_notified);

  const countRes = await countQuery.first();
  const total = countRes ? Number(countRes.total) : 0;

  return {
    data: rows,
    metadata: { page, limit, total, total_pages: Math.ceil(total / limit) }
  };
};

export const getOutboxEventWithLogs = async (eventId: string) => {
  const event = await findEventById(eventId);
  if (!event) return null;

  const logs = await db<OutboxEventLog>('outbox_event_logs')
    .where({ outbox_event_id: eventId })
    .orderBy('created_at', 'desc');

  return { ...event, logs };
};
