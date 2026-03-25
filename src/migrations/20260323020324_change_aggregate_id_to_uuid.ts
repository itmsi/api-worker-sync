import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // we do the alteration for both tables since both use 'aggregate_id' as integer initially.
  // Using gen_random_uuid() for fallback if casting the integer directly isn't logically possible
  await knex.raw(`
    ALTER TABLE outbox_events 
    ALTER COLUMN aggregate_id TYPE uuid USING (gen_random_uuid());
  `);

  await knex.raw(`
    ALTER TABLE integration_logs 
    ALTER COLUMN aggregate_id TYPE uuid USING (gen_random_uuid());
  `);
}

export async function down(knex: Knex): Promise<void> {
  // It's technically destructive to downgrade uuid to integer, 
  // so we'll just cast them back to a fallback zero if rollback is requested
  await knex.raw(`
    ALTER TABLE outbox_events 
    ALTER COLUMN aggregate_id TYPE integer USING (0);
  `);

  await knex.raw(`
    ALTER TABLE integration_logs 
    ALTER COLUMN aggregate_id TYPE integer USING (0);
  `);
}
