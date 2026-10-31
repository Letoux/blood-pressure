// Schéma Drizzle. Après toute modification : `pnpm db:generate` pour créer la migration SQL
// dans `drizzle/`, puis la committer. Les migrations s'appliquent au démarrage du conteneur `app`.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { FREQUENCY_MONTHS } from "@/domain/campaign";
import { REMINDER_DEFAULTS } from "@/domain/reminder";
import { MOMENTS } from "@/domain/slot";
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
  // Fuseau IANA, détecté depuis le navigateur puis modifiable. `null` : pas encore détecté
  // (`DEFAULT_TIME_ZONE` s'applique). Tous les jours de campagne sont comptés dans ce fuseau.
  timeZone: text("time_zone"),
  // Fréquence des campagnes, en mois (`GLOSSARY.md`).
  frequencyMonths: smallint("frequency_months").notNull().default(FREQUENCY_MONTHS.default),
  // Rappels (`GLOSSARY.md` : Rappel, Relance) : heures `HH:MM` dans le fuseau ci-dessus, validées
  // par le domaine (`src/domain/reminder.ts`). Ce ne sont pas des données de santé.
  morningTime: text("morning_time").notNull().default(REMINDER_DEFAULTS.morningTime),
  eveningTime: text("evening_time").notNull().default(REMINDER_DEFAULTS.eveningTime),
  dayBeforeReminder: boolean("day_before_reminder").notNull().default(REMINDER_DEFAULTS.dayBeforeReminder),
  followUpEnabled: boolean("follow_up_enabled").notNull().default(REMINDER_DEFAULTS.followUpEnabled),
  followUpDelayMinutes: smallint("follow_up_delay_minutes")
    .notNull()
    .default(REMINDER_DEFAULTS.followUpDelayMinutes),
  // Premier lancement vu (ou passé) : il ne s'affiche plus d'office.
  onboarded: boolean("onboarded").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check(
    "user_settings_frequency_months_check",
    sql`${table.frequencyMonths} between 1 and 12`,
  ),
  check(
    "user_settings_follow_up_delay_minutes_check",
    sql`${table.followUpDelayMinutes} between 15 and 240`,
  ),
]);

// --- Notifications push (ADR-0002, ADR-0003) ---

// Clés VAPID de l'instance : une seule ligne (`id = 1`), générée au premier démarrage
// (`src/server/push/vapid.ts`) puis réutilisée. Jamais dans le `.env` ni dans le dépôt.
export const vapidKeys = pgTable(
  "vapid_keys",
  {
    id: integer("id").primaryKey().default(1),
    publicKey: text("public_key").notNull(),
    privateKey: text("private_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("vapid_keys_single_row", sql`${table.id} = 1`)],
);

// Un abonnement Web Push par appareil (navigateur) d'un utilisateur. L'`endpoint` identifie
// l'appareil : s'il se réabonne avec un autre compte, l'abonnement change de propriétaire.
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("push_subscription_user_id_idx").on(table.userId)],
);

// --- Campagnes (voir `GLOSSARY.md`, ADR-0006) ---
// Seule la date de début prévue est stockée (jour local dans le fuseau de l'utilisateur). Le
// début réel, le statut (y compris « manquée »), la complétude et les moyennes sont calculés par
// le domaine (`src/domain/campaign.ts`) à partir des mesures. Supprimer une campagne supprime
// ses mesures (clé étrangère de `measurement`).

export const campaign = pgTable(
  "campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plannedStart: date("planned_start", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Deux saisies simultanées qui commencent la même campagne calculée n'en créent qu'une.
  (table) => [uniqueIndex("campaign_user_id_planned_start_idx").on(table.userId, table.plannedStart)],
);

// --- Mesures (voir `GLOSSARY.md`) ---
// Une ligne par mesure. Une mesure libre n'a ni campagne ni jour de campagne ; une mesure de
// campagne a les deux, rattachés à la saisie par le domaine (`attachMeasurement`).
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
    campaignId: uuid("campaign_id").references(() => campaign.id, { onDelete: "cascade" }),
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
