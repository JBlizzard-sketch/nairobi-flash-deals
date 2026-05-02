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
import { venuesTable } from "./venues";

export const dealStatusEnum = pgEnum("deal_status", [
  "draft",
  "live",
  "filling_fast",
  "sold_out",
  "expired",
  "cancelled",
]);

export const dealCategoryEnum = pgEnum("deal_category", [
  "lunch",
  "dinner",
  "brunch",
  "treatment",
  "class",
  "experience",
  "drinks",
  "tasting",
]);

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venuesTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: dealCategoryEnum("category").notNull(),
  discountPercent: integer("discount_percent").notNull(),
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }).notNull(),
  dealPrice: numeric("deal_price", { precision: 10, scale: 2 }).notNull(),
  totalSlots: integer("total_slots").notNull(),
  bookedSlots: integer("booked_slots").notNull().default(0),
  status: dealStatusEnum("status").notNull().default("draft"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  imageUrl: text("image_url"),

  // Standing deal fields
  isStanding: boolean("is_standing").notNull().default(false),
  standingDaysOfWeek: integer("standing_days_of_week").array(),
  standingStartHour: integer("standing_start_hour"),
  standingEndHour: integer("standing_end_hour"),
  autoActivateThreshold: integer("auto_activate_threshold"),

  // Engagement tracking
  viewCount: integer("view_count").notNull().default(0),
  notificationsSent: integer("notifications_sent").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({
  id: true,
  bookedSlots: true,
  status: true,
  viewCount: true,
  notificationsSent: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
