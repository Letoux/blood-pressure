import { asc, desc, eq } from "drizzle-orm";
import { measurement } from "@/server/db/schema";
import { measurementColumns } from "./measurement-input";
import { userOnly } from "./user-only";

/** Les mesures de l'appelant, de la plus récente à la plus ancienne. */
export const measurementsList = userOnly.handler(({ context }) =>
  context.db
    .select(measurementColumns)
    .from(measurement)
    .where(eq(measurement.userId, context.user.id))
    .orderBy(desc(measurement.takenAt), asc(measurement.createdAt), asc(measurement.id)),
);
