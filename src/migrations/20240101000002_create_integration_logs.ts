import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('integration_logs', (table) => {
    table.bigIncrements('id').primary();

    table.string('aggregate_type', 100).notNullable();
    table.integer('aggregate_id').notNullable();

    table.jsonb('request_payload').notNullable().defaultTo('{}');
    table.jsonb('response_payload').nullable();

    table
      .enum('status', ['SUCCESS', 'FAILED'])
      .notNullable();

    table.text('error_message').nullable();

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.table('integration_logs', (table) => {
    table.index(['aggregate_type', 'aggregate_id'], 'idx_integration_logs_aggregate');
    table.index(['status'], 'idx_integration_logs_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('integration_logs');
}
