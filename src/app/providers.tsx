"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
// Capte `beforeinstallprompt` dès le chargement, pour la page d'installation.
import "@/lib/install-prompt";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    // Service worker enregistré en production seulement (`src/app/sw.ts`). Pas de rechargement
    // au retour du réseau (le brouillon le rend inutile) ni de mise en cache des pages visitées
    // (ADR-0010 : aucune page connectée en cache).
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      reloadOnOnline={false}
      cacheOnNavigation={false}
      // Le bundle n'a ni import ni export : un worker classique, compris par tous les Safari.
      options={{ type: "classic" }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SerwistProvider>
  );
}
