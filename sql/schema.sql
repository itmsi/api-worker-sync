-- ============================================================
--  api-worker Database Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── outbox_events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbox_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100)  NOT NULL,
    aggregate_id   INTEGER       NOT NULL,
    event_type     VARCHAR(20)   NOT NULL CHECK (event_type IN ('CREATE', 'UPDATE', 'DELETE')),
    payload        JSONB         NOT NULL DEFAULT '{}',
    status         VARCHAR(20)   NOT NULL DEFAULT 'WAITING'
                     CHECK (status IN ('WAITING', 'PROCESSING', 'SUCCESS', 'FAILED')),
    retry_count    INTEGER       NOT NULL DEFAULT 0,
    max_retry      INTEGER       NOT NULL DEFAULT 5,
    last_error     TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outbox_status
    ON outbox_events (status);

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate_type
    ON outbox_events (aggregate_type);

-- Partial index for WAITING events — used heavily by the queue publisher
CREATE INDEX IF NOT EXISTS idx_outbox_waiting
    ON outbox_events (created_at)
    WHERE status = 'WAITING';

-- ── integration_logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_logs (
    id               BIGSERIAL    PRIMARY KEY,
    aggregate_type   VARCHAR(100) NOT NULL,
    aggregate_id     INTEGER      NOT NULL,
    request_payload  JSONB        NOT NULL DEFAULT '{}',
    response_payload JSONB,
    status           VARCHAR(20)  NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    error_message    TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_aggregate
    ON integration_logs (aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_integration_logs_status
    ON integration_logs (status);
