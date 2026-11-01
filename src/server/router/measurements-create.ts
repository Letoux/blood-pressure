import { z } from "zod";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { slotColumns } from "@/server/campaigns/attach";
import { measurement } from "@/server/db/schema";
import { comment, measurementColumns, measurementValues, moment } from "./measurement-input";
import { userOnly } from "./authed";
import { currentTime } from "./base";

/**
 * Enregistre les mesures d'un formulaire de créneau (1 à 3), avec le même horodatage, le même
 * moment et le même commentaire. Pendant une campagne, elles sont rattachées à son créneau (jour
 * selon l'horodatage, moment choisi) ; hors campagne, ce sont des mesures libres (ADR-0006).
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
    context.db.transaction(async (tx) => {
      const userId = context.user.id;
      const state = await loadCampaignInput(tx, userId, currentTime(context));
      const slot = await slotColumns(tx, userId, state, input.takenAt);
      return tx
        .insert(measurement)
        .values(
          input.measurements.map((values) => ({
            ...values,
            ...slot,
            userId,
            takenAt: input.takenAt,
            moment: input.moment,
            comment: input.comment,
          })),
        )
        .returning(measurementColumns);
    }),
  );
