// Schéma Drizzle. Après toute modification : `pnpm db:generate` pour créer la migration SQL
// dans `drizzle/`, puis la committer. Les migrations s'appliquent au démarrage du conteneur `app`.
import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { MOMENTS } from "@/domain/slot";
import { LOCALES } from "@/i18n/locale";
import { DEFAULT_THEME, THEMES } from "@/lib/theme";

// --- Authentification (better-auth, plugin admin) : ADR-0004, ADR-0009 ---
// Noms de tables et de colonnes attendus par better-auth (`src/server/auth`).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Plugin admin : `admin` ou `user`.
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    // Hash argon2id (format PHC `$argon2id$…`).
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// --- Réglages de l'utilisateur ---
// Une ligne par utilisateur, créée au premier enregistrement : sans ligne, les valeurs par
// défaut s'appliquent. Le nom affiché reste `user.name`, celui de better-auth.

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // `null` : la langue du navigateur, sinon le français.
  locale: text("locale", { enum: LOCALES }),
  theme: text("theme", { enum: THEMES }).notNull().default(DEFAULT_THEME),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Mesures (voir `GLOSSARY.md`) ---
// Une ligne par mesure. Une mesure libre n'a ni campagne ni jour de campagne ; une mesure de
// campagne a les deux (ticket Campagnes, qui ajoutera la table `campaign` et la clé étrangère).
// Les bornes des valeurs sont vérifiées par le domaine (`src/domain/measurement.ts`).

export const measurement = pgTable(
  "measurement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    systolic: smallint("systolic").notNull(),
    diastolic: smallint("diastolic").notNull(),
    pulse: smallint("pulse").notNull(),
    comment: text("comment"),
    // Créneau : le moment est toujours connu ; le jour (1 à 3) seulement dans une campagne.
    moment: text("moment", { enum: MOMENTS }).notNull(),
    campaignId: uuid("campaign_id"),
    campaignDay: smallint("campaign_day"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("measurement_user_id_taken_at_idx").on(table.userId, table.takenAt),
    index("measurement_campaign_id_idx").on(table.campaignId),
    check(
      "measurement_campaign_slot_check",
      sql`(${table.campaignId} is null and ${table.campaignDay} is null) or (${table.campaignId} is not null and ${table.campaignDay} between 1 and 3)`,
    ),
  ],
);
