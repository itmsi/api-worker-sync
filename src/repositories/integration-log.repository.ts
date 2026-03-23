import { db } from '../config/db';

export interface IntegrationLogInput {
  aggregate_type: string;
  aggregate_id: string;
  request_payload: Record<string, unknown>;
  response_payload?: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string;
}

const TABLE = 'integration_logs';

export const createIntegrationLog = async (data: IntegrationLogInput): Promise<void> => {
  await db(TABLE).insert({
    aggregate_type: data.aggregate_type,
    aggregate_id: data.aggregate_id,
    request_payload: JSON.stringify(data.request_payload),
    response_payload: data.response_payload ? JSON.stringify(data.response_payload) : null,
    status: data.status,
    error_message: data.error_message ?? null,
    created_at: db.fn.now(),
  });
};
