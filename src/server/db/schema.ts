// Schéma Drizzle. Après toute modification : `pnpm db:generate` pour créer la migration SQL
// dans `drizzle/`, puis la committer. Les migrations s'appliquent au démarrage du conteneur `app`.
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { LOCALES } from "@/i18n/locale";
import { DEFAULT_THEME, THEMES } from "@/lib/theme";

// --- Réglages de l'instance, modifiés par l'admin (ADR-0004) ---
// Une seule ligne (`id = 1`), créée au premier enregistrement ; absente = valeurs par défaut.

export const appSettings = pgTable(
  "app_settings",
  {
    id: integer("id").primaryKey().default(1),
    // Inscription libre, désactivée par défaut : seul l'admin crée les comptes.
    signUpOpen: boolean("sign_up_open").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("app_settings_single_row", sql`${table.id} = 1`)],
);

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
  // Après une réinitialisation par l'admin : l'app propose (sans l'imposer) de changer de
  // mot de passe, jusqu'au changement ou à la fermeture du bandeau (ADR-0004).
  passwordChangeSuggested: boolean("password_change_suggested").notNull().default(false),
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
