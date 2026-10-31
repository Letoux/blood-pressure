import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { measurement } from "@/server/db/schema";
import { comment, measurementColumns, measurementValues, moment, ownMeasurement } from "./measurement-input";
import { userOnly } from "./user-only";

/** Remplace l'horodatage, le moment, les valeurs et le commentaire d'une mesure de l'appelant. */
export const measurementsUpdate = userOnly
  .input(
    z
      .object({ id: z.uuid(), takenAt: z.date(), moment, comment })
      .and(measurementValues),
  )
  .handler(async ({ context, input }) => {
    const { id, ...fields } = input;
    const [updated] = await context.db
      .update(measurement)
      .set({ ...fields, updatedAt: new Date() })
      .where(ownMeasurement(id, context.user.id))
      .returning(measurementColumns);
    if (!updated) throw new ORPCError("NOT_FOUND");
    return updated;
  });
