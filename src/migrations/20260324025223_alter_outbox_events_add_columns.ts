import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("outbox_events", (table) => {
    table.string("destination").nullable();
    table.enum("is_notified", ['0', '1']).defaultTo('0').comment('0: failed, 1: success');
    table.string("created_by").nullable();
    table.string("updated_by").nullable();
    table.boolean("is_deleted").defaultTo(false);
    table.jsonb("properties").nullable();
    table.integer("app_id").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("outbox_events", (table) => {
    table.dropColumn("destination");
    table.dropColumn("is_notified");
    table.dropColumn("created_by");
    table.dropColumn("updated_by");
    table.dropColumn("is_deleted");
    table.dropColumn("properties");
    table.dropColumn("app_id");
  });
}
