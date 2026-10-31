import { z } from "zod";
import { measurement } from "@/server/db/schema";
import { comment, measurementColumns, measurementValues, moment } from "./measurement-input";
import { userOnly } from "./user-only";

/**
 * Enregistre les mesures d'un formulaire de créneau (1 à 3), avec le même horodatage, le même
 * moment et le même commentaire. Hors campagne, ce sont des mesures libres.
 */
export const measurementsCreate = userOnly
  .input(
    z.object({
      takenAt: z.date(),
      moment,
      comment,
      measurements: z.array(measurementValues).min(1).max(3),
    }),
  )
  .handler(({ context, input }) =>
    context.db
      .insert(measurement)
      .values(
        input.measurements.map((values) => ({
          ...values,
          userId: context.user.id,
          takenAt: input.takenAt,
          moment: input.moment,
          comment: input.comment,
        })),
      )
      .returning(measurementColumns),
  );
