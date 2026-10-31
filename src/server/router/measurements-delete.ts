import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { measurement } from "@/server/db/schema";
import { ownMeasurement } from "./measurement-input";
import { userOnly } from "./user-only";

/** Supprime une mesure de l'appelant. */
export const measurementsDelete = userOnly
  .input(z.object({ id: z.uuid() }))
  .handler(async ({ context, input }) => {
    const deleted = await context.db
      .delete(measurement)
      .where(ownMeasurement(input.id, context.user.id))
      .returning({ id: measurement.id });
    if (deleted.length === 0) throw new ORPCError("NOT_FOUND");
  });
