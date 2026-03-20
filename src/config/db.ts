import knex, { Knex } from 'knex';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
dotenv.config();

const config: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'worker_db',
  },
  pool: {
    min: 2,
    max: 20,
    afterCreate: (conn: { query: Function }, done: Function) => {
      conn.query('SET timezone="UTC";', (err: Error) => {
        done(err, conn);
      });
    },
  },
  migrations: {
    directory: './src/migrations',
    extension: 'ts',
    tableName: 'knex_migrations',
  },
};

export const db: Knex = knex(config);

export const checkDbConnection = async (): Promise<void> => {
  try {
    await db.raw('SELECT 1');
    logger.info('Connected to PostgreSQL (Knex) successfully.');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to PostgreSQL via Knex');
    throw err;
  }
};

export const closeDbConnection = async (): Promise<void> => {
  await db.destroy();
  logger.info('PostgreSQL (Knex) connection pool closed.');
};
