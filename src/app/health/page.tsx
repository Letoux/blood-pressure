"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export default function HealthPage() {
  const { data, isError } = useQuery(orpc.health.queryOptions());

  const label = data?.status === "ok" ? "OK" : isError ? "Erreur" : "…";

  return (
    <main>
      <h1>Santé de l’application</h1>
      <p role="status">{label}</p>
    </main>
  );
}
