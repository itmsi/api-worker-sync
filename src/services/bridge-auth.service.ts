import axios from 'axios';
import { logger } from '../utils/logger';

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

export const getBridgeToken = async (): Promise<string> => {
  // Check if we have a valid cached token (buffer of 5 minutes just in case)
  const now = Date.now();
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt - 300000) {
    return cachedToken;
  }

  const middlewareUrl = process.env.API_BRIDGE_URL || process.env.MIDDLEWARE_API_URL || 'http://localhost:9570';
  const endpoint = `${middlewareUrl}/api/v1/bridge/auth/token`;
  
  const clientId = process.env.API_BRIDGE_CLIENT_ID;
  const clientSecret = process.env.API_BRIDGE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // Fallback to static token from env if client ID/secret are not provided
    if (process.env.API_BRIDGE_TOKEN) {
      return process.env.API_BRIDGE_TOKEN;
    }
    logger.error('[BridgeAuth] API_BRIDGE_CLIENT_ID or API_BRIDGE_CLIENT_SECRET is missing. Cannot fetch token.');
    throw new Error('API Bridge credentials missing in .env');
  }

  try {
    const response = await axios.post(
      endpoint,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const rsData = response.data;
    if (rsData?.success && rsData?.data?.access_token) {
      cachedToken = rsData.data.access_token;
      
      // expires_in is in seconds
      const expiresIn = rsData.data.expires_in || 86400;
      tokenExpiresAt = now + expiresIn * 1000;
      
      logger.info('[BridgeAuth] Successfully fetched new API Bridge token.');
      return cachedToken as string;
    } else {
      throw new Error('Invalid response structure from auth token endpoint');
    }
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, '[BridgeAuth] Failed to fetch token');
    
    // Fallback to static token from env if it exists
    if (process.env.API_BRIDGE_TOKEN) {
      logger.info('[BridgeAuth] Using static API_BRIDGE_TOKEN as fallback.');
      return process.env.API_BRIDGE_TOKEN;
    }
    
    throw new Error('Failed to obtain bridge token');
  }
};
