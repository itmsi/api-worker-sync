import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("outbox_event_logs", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("outbox_event_id").nullable().references("id").inTable("outbox_events").onDelete("CASCADE");
    table.string("http_status").nullable();
    table.text("error").nullable();
    table.jsonb("properties").nullable();
    table.string("created_by").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.string("updated_by").nullable();
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.boolean("is_deleted").defaultTo(false);
    table.timestamp("deleted_at", { useTz: true }).nullable();
    table.string("deleted_by").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("outbox_event_logs");
}
