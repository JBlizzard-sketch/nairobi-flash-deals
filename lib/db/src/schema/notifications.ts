import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { dealsTable } from "./deals";

export const notificationStatusEnum = pgEnum("notification_status", [
  "sent",
  "delivered",
  "failed",
  "simulated",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "push",
  "whatsapp",
  "sms",
]);

export const notificationLogTable = pgTable("notification_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  dealId: integer("deal_id")
    .notNull()
    .references(() => dealsTable.id),
  channel: notificationChannelEnum("channel").notNull().default("push"),
  status: notificationStatusEnum("status").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  fcmMessageId: text("fcm_message_id"),
  errorMessage: text("error_message"),
  distanceKm: text("distance_km"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export type NotificationLog = typeof notificationLogTable.$inferSelect;
