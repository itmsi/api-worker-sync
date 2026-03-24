import axios from 'axios';
import { db } from '../config/db';
import { OutboxEvent, insertEventLog, updateEventStatus } from '../repositories/outbox.repository';
// import { createIntegrationLog } from '../repositories/integration-log.repository'; // if still needed, can be imported
import { logger } from '../utils/logger';
import { getBridgeToken } from '../services/bridge-auth.service';

export const handleCustomerEvent = async (event: OutboxEvent): Promise<void> => {
  // Gunakan variabel dari .env sesuai permintaan, fallback ke nilai default 'http://localhost:9570'
  const middlewareUrl = process.env.API_BRIDGE_URL || process.env.MIDDLEWARE_API_URL || 'http://localhost:9570';
  const endpoint = `${middlewareUrl}/api/v1/bridge/customers/create`;
  const token = await getBridgeToken();

  const payload = event.payload as any;
  const requestPayload = {
    isPerson: payload.isPerson ?? false,
    companyName: payload.customer_name || payload.companyName || "",
    customer_code: payload.customer_code || "",
    subsidiary: payload.subsidiary || 1,
    subsidiaries: payload.subsidiaries || [1],
    email: payload.customer_email || payload.email || "",
    phone: payload.customer_phone || payload.phone || "",
    lifetime: payload.lifetime || 1,
    value: payload.value || 1,
    entitystatus: payload.entitystatus || 13,
    address: {
      defaultbilling: payload.address?.defaultbilling ?? true,
      defaultshipping: payload.address?.defaultshipping ?? true,
      addr1: payload.customer_address || payload.address?.addr1 || "",
      city: payload.customer_city || payload.address?.city || "",
      state: payload.customer_state || payload.address?.state || "",
      zip: payload.customer_zip || payload.address?.zip || "",
      // country: payload.customer_country || payload.address?.country || "ID"
      country: "ID" //hardcode
    }
  };

  logger.info(
    { event_id: event.id, aggregate_id: event.aggregate_id, event_type: event.event_type },
    '[CustomerHandler] Sending request to API Bridge'
  );

  let httpStatus: number | null = null;
  let responseData: any = null;
  let errorMessage: string | null = null;
  let isNotified: '0' | '1' = '0';

  try {
    const response = await axios.post(endpoint, requestPayload, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Token dari .env
      },
    });

    httpStatus = response.status;
    responseData = response.data;
    isNotified = '1';

    // Update customers table if netsuite_id is returned
    const netsuiteId = responseData?.data?.netsuite_id;
    if (netsuiteId) {
      await db('customers')
        .where({ customer_id: event.aggregate_id })
        .update({ customer_id_netsuite: netsuiteId });
      logger.info({ aggregate_id: event.aggregate_id, netsuite_id: netsuiteId }, '[CustomerHandler] Updated customers table with customer_id_netsuite');
    }

    logger.info(
      { event_id: event.id, status: httpStatus },
      '[CustomerHandler] Request successful'
    );
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      httpStatus = err.response?.status ?? null;
      errorMessage = err.message;
      responseData = err.response?.data ?? null;
    } else {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    logger.error({ event_id: event.id, err }, '[CustomerHandler] Request failed');
    throw err;
  } finally {
    const errorString = errorMessage ? String(errorMessage) : null;

    let propertiesToSave = null;
    if (responseData) {
      propertiesToSave = typeof responseData === 'object' ? responseData : { data: responseData };
    }

    // 1. Insert ke tabel outbox_event_logs sesuai instruksi
    await insertEventLog({
      outbox_event_id: event.id,
      http_status: httpStatus ? String(httpStatus) : null,
      error: errorString,
      properties: propertiesToSave,
    });

    // 2. Update field is_notified di tabel outbox_events menggunakan updateEventStatus
    await updateEventStatus(
      event.id,
      isNotified === '1' ? 'PROCESSING' : 'FAILED', // Tetap di status perantara karena Consumer akan mengubahnya ke SUCCESS/WAITING
      errorMessage || undefined,
      isNotified,
      endpoint // Simpan URL tujuan ke origin database
    );
  }
};
