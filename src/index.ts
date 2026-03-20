import 'dotenv/config';
import app from './app';
import { checkDbConnection, closeDbConnection } from './config/db';
import { connectRabbitMQ, disconnectRabbitMQ } from './config/rabbitmq';
import { startConsumer } from './consumers/queue.consumer';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '4000', 10);

const bootstrap = async (): Promise<void> => {
  logger.info('🚀 Starting api-worker...');

  // 1. Connect to PostgreSQL via Knex
  await checkDbConnection();

  // 2. Connect to RabbitMQ & start consumer
  await connectRabbitMQ();
  await startConsumer();

  // 3. Start Express API (health + retry endpoints)
  const server = app.listen(PORT, () => {
    logger.info(`✅ HTTP server listening on port ${PORT}`);
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────── //
  const shutdown = async (signal: string): Promise<void> => {
    logger.warn(`[Shutdown] Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      logger.info('[Shutdown] HTTP server closed');
      await disconnectRabbitMQ();
      await closeDbConnection();
      logger.info('[Shutdown] All connections closed. Exiting.');
      process.exit(0);
    });

    // Force exit after 15 seconds
    setTimeout(() => {
      logger.error('[Shutdown] Forced exit after timeout');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '[Process] Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, '[Process] Uncaught exception — shutting down');
    process.exit(1);
  });
};

bootstrap().catch((err) => {
  logger.error({ err }, '❌ Failed to bootstrap worker');
  process.exit(1);
});
