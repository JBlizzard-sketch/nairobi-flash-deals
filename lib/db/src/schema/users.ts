import { pgTable, text, serial, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loyaltyTierEnum = pgEnum("loyalty_tier", ["bronze", "silver", "gold", "platinum"]);
export const userRoleEnum = pgEnum("user_role", ["customer", "venue_manager", "admin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  email: text("email").unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("customer"),
  loyaltyTier: loyaltyTierEnum("loyalty_tier").notNull().default("bronze"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  subscriptionCategories: text("subscription_categories")
    .array()
    .notNull()
    .default(["restaurant", "spa", "bar", "fitness", "experience"]),
  latitude: text("latitude"),
  longitude: text("longitude"),
  neighborhoodPref: text("neighborhood_pref"),
  managedVenueId: integer("managed_venue_id"),
  pushToken: text("push_token"),
  isActive: boolean("is_active").notNull().default(true),
  referralCode: text("referral_code").unique(),
  referredByUserId: integer("referred_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  loyaltyTier: true,
  loyaltyPoints: true,
  referralCode: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
