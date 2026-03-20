import amqp, { Channel, ChannelModel } from 'amqplib';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
dotenv.config();

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export const connectRabbitMQ = async (): Promise<Channel> => {
  if (channel) return channel;

  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  try {
    connection = await amqp.connect(url);

    connection.on('error', (err: Error) => {
      logger.error({ err }, 'RabbitMQ connection error');
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed. Attempting to reconnect...');
      channel = null;
      connection = null;
      setTimeout(connectRabbitMQ, 5000);
    });

    // amqplib v0.10 uses createChannel() on the connection object
    const conn = connection as unknown as {
      createChannel(): Promise<Channel>;
    };
    channel = await conn.createChannel();

    // ── Exchanges ──────────────────────────────────────────────
    await channel.assertExchange('sync.exchange', 'direct', { durable: true });
    await channel.assertExchange('sync.dlx', 'direct', { durable: true });

    // ── Queues ─────────────────────────────────────────────────
    await channel.assertQueue('sync.events', {
      durable: true,
      deadLetterExchange: 'sync.dlx',
      deadLetterRoutingKey: 'sync.dlq',
    });
    await channel.assertQueue('sync.events.dlq', { durable: true });

    // ── Bindings ───────────────────────────────────────────────
    await channel.bindQueue('sync.events', 'sync.exchange', 'events');
    await channel.bindQueue('sync.events.dlq', 'sync.dlx', 'sync.dlq');

    logger.info('Connected to RabbitMQ successfully.');
    return channel;
  } catch (err) {
    logger.error({ err }, 'Failed to connect to RabbitMQ. Retrying in 5s...');
    setTimeout(connectRabbitMQ, 5000);
    throw err;
  }
};

export const getRabbitMQChannel = (): Channel => {
  if (!channel) throw new Error('RabbitMQ channel is not initialized.');
  return channel;
};

export const disconnectRabbitMQ = async (): Promise<void> => {
  try {
    await channel?.close();
    const conn = connection as unknown as { close(): Promise<void> } | null;
    await conn?.close();
  } catch (err) {
    logger.error({ err }, 'Error while gracefully disconnecting RabbitMQ');
  }
};
