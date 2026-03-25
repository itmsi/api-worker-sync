import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable pgcrypto for gen_random_uuid()
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('outbox_events', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));

    table.string('aggregate_type', 100).notNullable();
    table.integer('aggregate_id').notNullable();

    table
      .enum('event_type', ['CREATE', 'UPDATE', 'DELETE'])
      .notNullable();

    table.jsonb('payload').notNullable().defaultTo('{}');

    table
      .enum('status', ['WAITING', 'PROCESSING', 'SUCCESS', 'FAILED'])
      .notNullable()
      .defaultTo('WAITING');

    table.integer('retry_count').notNullable().defaultTo(0);
    table.integer('max_retry').notNullable().defaultTo(5);
    table.text('last_error').nullable();

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Index on status
  await knex.schema.table('outbox_events', (table) => {
    table.index(['status'], 'idx_outbox_status');
    table.index(['aggregate_type'], 'idx_outbox_aggregate_type');
  });

  // Partial index: only WAITING events (optimizes queue polling)
  await knex.raw(`
    CREATE INDEX idx_outbox_waiting
    ON outbox_events (created_at)
    WHERE status = 'WAITING'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_outbox_waiting');
  await knex.schema.dropTableIfExists('outbox_events');
}
