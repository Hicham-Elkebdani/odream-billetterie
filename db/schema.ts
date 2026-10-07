import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
export const eventSettings = sqliteTable("event_settings", {
  id: text("id").primaryKey(), name: text("name").notNull(), date: text("date").notNull(), time: text("time").notNull(),
  departure: text("departure").notNull(), destination: text("destination").notNull(), priceCents: integer("price_cents"), capacity: integer("capacity"),
  program: text("program").notNull(), checkpoints: text("checkpoints").notNull(),
});
export const tickets = sqliteTable("tickets", {
  id:text("id").primaryKey(), reference:text("reference").notNull().unique(), token:text("token").notNull().unique(),
  name:text("name").notNull(), email:text("email").notNull(), phone:text("phone").notNull(), status:text("status").notNull().default("pending"),
  amountCents:integer("amount_cents"), createdAt:text("created_at").notNull(), paidAt:text("paid_at"), paidBy:text("paid_by"),
  cancelledAt:text("cancelled_at"), refundedAt:text("refunded_at"), sentAt:text("sent_at"), emailId:text("email_id"), emailAttempt:text("email_attempt"), emailError:text("email_error"),emailPayload:text("email_payload"),emailAttemptAt:text("email_attempt_at"),
});
export const checkins=sqliteTable("checkins", {
  id:text("id").primaryKey(),ticketId:text("ticket_id").notNull().references(()=>tickets.id),checkpoint:text("checkpoint").notNull(),scannedAt:text("scanned_at").notNull(),scannedBy:text("scanned_by").notNull(),
},table=>[uniqueIndex("one_checkin_per_checkpoint").on(table.ticketId,table.checkpoint)]);
