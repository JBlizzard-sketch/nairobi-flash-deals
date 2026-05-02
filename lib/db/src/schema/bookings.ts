import {
  pgTable,
  text,
  serial,
  timestamp,
  pgEnum,
  integer,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dealsTable } from "./deals";
import { usersTable } from "./users";
import { venuesTable } from "./venues";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending_payment",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "refunded",
]);

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id")
    .notNull()
    .references(() => dealsTable.id),
  userId: integer("user_id")
    .references(() => usersTable.id),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venuesTable.id),
  slots: integer("slots").notNull().default(1),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }).notNull(),
  venueAmount: numeric("venue_amount", { precision: 10, scale: 2 }).notNull(),
  status: bookingStatusEnum("status").notNull().default("pending_payment"),
  mpesaRef: text("mpesa_ref"),
  mpesaCheckoutRequestId: text("mpesa_checkout_request_id"),
  confirmationCode: text("confirmation_code").notNull(),
  specialRequests: text("special_requests"),
  isCorporate: boolean("is_corporate").notNull().default(false),
  corporateName: text("corporate_name"),
  checkedInAt: timestamp("checked_in_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  status: true,
  checkedInAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
