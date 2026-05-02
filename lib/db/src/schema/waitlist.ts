import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { dealsTable } from "./deals";
import { usersTable } from "./users";

export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => dealsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  position: integer("position").notNull(),
  status: text("status").notNull().default("waiting"),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Waitlist = typeof waitlistTable.$inferSelect;
