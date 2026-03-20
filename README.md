# api-worker

> **Production-ready Worker Service** — Node.js + Express.js + TypeScript + RabbitMQ + PostgreSQL  
> Implements the **Outbox Pattern** with a single generic table, modular handlers, retry with exponential backoff, and DLQ support.

---

## 📦 Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript |
| Queue | RabbitMQ (amqplib) |
| Database | PostgreSQL 16 |
| HTTP API | Express.js |
| Logger | Pino |
| Container | Docker + Docker Compose |

---

## 🗂️ Project Structure

```
src/
├── config/
│   ├── db.ts              # PostgreSQL pool
│   └── rabbitmq.ts        # RabbitMQ connection & queue setup
├── consumers/
│   └── queue.consumer.ts  # Main RabbitMQ consumer
├── handlers/
│   ├── customer.handler.ts
│   └── vendor.handler.ts  # Template (not yet implemented)
├── repositories/
│   ├── outbox.repository.ts
│   └── integration-log.repository.ts
├── routes/
│   ├── health.routes.ts
│   └── retry.routes.ts
├── services/
│   ├── event-router.service.ts  # Routes events to handlers
│   └── retry.service.ts         # Retry + backoff + DLQ logic
├── utils/
│   └── logger.ts
├── app.ts                 # Express app
└── index.ts               # Worker bootstrap + graceful shutdown

sql/
└── schema.sql             # Database schema

docker-compose.yml
Dockerfile
.env.example
```

---

## 🚀 Getting Started

### 1. Clone & configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your `MIDDLEWARE_API_URL` accordingly.

### 2. Run with Docker (recommended)

```bash
docker-compose up --build
```

This starts:
- **worker** on port `4000`
- **postgres** on port `5432`
- **rabbitmq** on port `5672` (Management UI: http://localhost:15672)

> Schema is auto-applied via `sql/schema.sql` on first Postgres startup.

### 3. Run locally (development)

```bash
# Install dependencies
npm install

# Start PostgreSQL & RabbitMQ via Docker
docker-compose up postgres rabbitmq -d

# Run in dev mode with hot-reload
npm run dev
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Node environment |
| `PORT` | `4000` | HTTP server port |
| `LOG_LEVEL` | `info` | Pino log level |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | DB username |
| `DB_PASSWORD` | `postgres` | DB password |
| `DB_NAME` | `worker_db` | Database name |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | RabbitMQ connection URL |
| `RABBITMQ_PREFETCH` | `5` | Consumer prefetch count |
| `MIDDLEWARE_API_URL` | `http://localhost:3000` | Middleware API base URL |

---

## 🐇 RabbitMQ Setup

| Resource | Name | Type |
|---|---|---|
| Exchange | `sync.exchange` | direct |
| Main Queue | `sync.events` | durable |
| DLX Exchange | `sync.dlx` | direct |
| Dead Letter Queue | `sync.events.dlq` | durable |

### Message Format

```json
{ "event_id": "uuid-of-outbox-event" }
```

---

## 🔁 Worker Processing Flow

```
RabbitMQ (sync.events)
        │
        ▼
  queue.consumer.ts
        │
        ├── fetch event from outbox_events by event_id
        ├── update status → PROCESSING
        ├── route by aggregate_type → handler
        │       ├── customer → customer.handler.ts
        │       └── vendor   → vendor.handler.ts (template)
        │
        ├── SUCCESS → update status = SUCCESS, ACK message
        └── FAILURE → increment retry_count
                        ├── if retry_count < max_retry → wait backoff → re-publish
                        └── if retry_count >= max_retry → send to DLQ, status = FAILED
```

### Exponential Backoff Delays

| Attempt | Delay |
|---|---|
| 1st | 1 second |
| 2nd | 5 seconds |
| 3rd | 30 seconds |
| 4th | 2 minutes |
| 5th | 10 minutes |

---

## 🌐 HTTP API Endpoints

### Health Check

```bash
GET /health
```

### Manual Retry — Single Event

```bash
POST /retry/:event_id
```

### Manual Retry — By Module

```bash
POST /retry/module/:type

# Example — retry all failed customer events:
curl -X POST http://localhost:4000/retry/module/customer
```

### Manual Retry — Bulk (with filters)

```bash
POST /retry/bulk
Content-Type: application/json

{
  "aggregate_type": "customer",
  "from_date": "2024-01-01",
  "to_date": "2024-12-31",
  "status": "FAILED"
}
```

---

## 🧩 Adding a New Module Handler

1. Create `src/handlers/mymodule.handler.ts`
2. Export `handleMymoduleEvent(event: OutboxEvent): Promise<void>`
3. Register it in `src/services/event-router.service.ts`:

```ts
import { handleMymoduleEvent } from '../handlers/mymodule.handler';

const handlerRegistry: Record<string, HandlerFn> = {
  customer: handleCustomerEvent,
  vendor: handleVendorEvent,
  mymodule: handleMymoduleEvent,  // ← add here
};
```

No other changes needed.

---

## 🏗️ Build for Production

```bash
npm run build
npm start
```

---

## 🧪 Testing the Worker Manually

Insert a test event directly into the DB, then publish its ID to the queue:

```sql
-- 1. Insert test outbox event
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
VALUES ('customer', 1, 'CREATE', '{"name": "Test Customer", "email": "test@example.com"}');

-- 2. Get the generated ID
SELECT id FROM outbox_events ORDER BY created_at DESC LIMIT 1;
```

Then publish via RabbitMQ Management UI (http://localhost:15672):
- Exchange: `sync.exchange`  
- Routing key: `events`  
- Payload: `{"event_id": "<uuid-from-above>"}`
