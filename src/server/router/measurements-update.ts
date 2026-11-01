import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { slotColumns } from "@/server/campaigns/attach";
import { measurement } from "@/server/db/schema";
import { comment, measurementColumns, measurementValues, moment, ownMeasurement } from "./measurement-input";
import { userOnly } from "./authed";
import { currentTime } from "./base";

/**
 * Remplace l'horodatage, le moment, les valeurs et le commentaire d'une mesure de l'appelant.
 * Son créneau est recalculé comme à la saisie, sans tenir compte d'elle-même.
 */
export const measurementsUpdate = userOnly
  .input(
    z
      .object({ id: z.uuid(), takenAt: z.date(), moment, comment })
      .and(measurementValues),
  )
  .handler(({ context, input }) =>
    context.db.transaction(async (tx) => {
      const { id, ...fields } = input;
      const userId = context.user.id;
      const state = await loadCampaignInput(tx, userId, currentTime(context), { excludeMeasurementId: id });
      const slot = await slotColumns(tx, userId, state, input.takenAt);
      const [updated] = await tx
        .update(measurement)
        .set({ ...fields, ...slot, updatedAt: new Date() })
        .where(ownMeasurement(id, userId))
        .returning(measurementColumns);
      if (!updated) throw new ORPCError("NOT_FOUND");
      return updated;
    }),
  );
