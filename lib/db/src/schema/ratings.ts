import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bookingsTable } from "./bookings";
import { usersTable } from "./users";
import { venuesTable } from "./venues";
import { dealsTable } from "./deals";

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id")
    .notNull()
    .unique()
    .references(() => bookingsTable.id),
  userId: integer("user_id")
    .references(() => usersTable.id),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venuesTable.id),
  dealId: integer("deal_id")
    .notNull()
    .references(() => dealsTable.id),
  score: integer("score").notNull(),
  comment: text("comment"),
  response: text("response"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({
  id: true,
  response: true,
  respondedAt: true,
  createdAt: true,
});

export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
