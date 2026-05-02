import {
  pgTable,
  text,
  serial,
  timestamp,
  pgEnum,
  boolean,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const venueCategoryEnum = pgEnum("venue_category", [
  "restaurant",
  "spa",
  "bar",
  "fitness",
  "experience",
]);

export const venueStatusEnum = pgEnum("venue_status", [
  "pending_approval",
  "approved",
  "suspended",
]);

export const venueNeighborhoodEnum = pgEnum("venue_neighborhood", [
  "westlands",
  "kilimani",
  "cbd",
  "karen",
  "langata",
  "lavington",
  "kileleshwa",
  "runda",
  "muthaiga",
  "gigiri",
  "upper_hill",
  "other",
]);

export const venuesTable = pgTable("venues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: venueCategoryEnum("category").notNull(),
  neighborhood: venueNeighborhoodEnum("neighborhood").notNull(),
  address: text("address").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  description: text("description").notNull(),
  coverImage: text("cover_image"),
  images: text("images").array().notNull().default([]),
  whatsappNumber: text("whatsapp_number"),
  contactEmail: text("contact_email"),
  websiteUrl: text("website_url"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 })
    .notNull()
    .default("15.00"),
  status: venueStatusEnum("status").notNull().default("pending_approval"),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }).default("0.00"),
  totalRatings: integer("total_ratings").notNull().default(0),
  totalBookings: integer("total_bookings").notNull().default(0),
  fillRate: numeric("fill_rate", { precision: 5, scale: 2 }).default("0.00"),
  tags: text("tags").array().notNull().default([]),
  isWhitelabel: boolean("is_whitelabel").notNull().default(false),
  whitelabelOwnerId: integer("whitelabel_owner_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVenueSchema = createInsertSchema(venuesTable).omit({
  id: true,
  status: true,
  averageRating: true,
  totalRatings: true,
  totalBookings: true,
  fillRate: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVenue = z.infer<typeof insertVenueSchema>;
export type Venue = typeof venuesTable.$inferSelect;
