import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { validateMeasurement } from "@/domain/measurement";
import { MOMENTS } from "@/domain/slot";
import { measurement } from "@/server/db/schema";

/** Valeurs d'une mesure, validées par le domaine (`BAD_REQUEST` sinon). */
export const measurementValues = z
  .object({ systolic: z.number().int(), diastolic: z.number().int(), pulse: z.number().int() })
  .superRefine((values, ctx) => {
    for (const error of validateMeasurement(values)) ctx.addIssue({ code: "custom", message: error });
  });

export const moment = z.enum(MOMENTS);

/** Commentaire facultatif : un texte vide est enregistré comme absent. */
export const comment = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((text) => (text ? text : null));

/** Colonnes renvoyées au client pour une mesure. */
export const measurementColumns = {
  id: measurement.id,
  takenAt: measurement.takenAt,
  systolic: measurement.systolic,
  diastolic: measurement.diastolic,
  pulse: measurement.pulse,
  comment: measurement.comment,
  moment: measurement.moment,
  campaignId: measurement.campaignId,
  campaignDay: measurement.campaignDay,
};

/** Condition « cette mesure appartient à cet utilisateur » : une mesure d'un autre est introuvable. */
export const ownMeasurement = (id: string, userId: string) =>
  and(eq(measurement.id, id), eq(measurement.userId, userId));
