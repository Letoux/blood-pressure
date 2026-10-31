# Stack : Next.js, oRPC, TanStack Query, Postgres, Drizzle et better-auth

- **Next.js** pour l'app web et la PWA.
- **oRPC** pour l'API typée, consommée avec **TanStack Query**.
- **Postgres** comme seule base de données. Elle sert aussi de file de tâches (ADR-0003).
- **Drizzle** comme ORM, avec des migrations SQL versionnées appliquées au démarrage du conteneur.
- **better-auth** pour l'authentification par email et mot de passe, avec son plugin admin, et parce qu'il offre l'OAuth prévu plus tard (Google, GitHub, X, Facebook). Les mots de passe sont hachés en **argon2id** via un hasher personnalisé, et non avec le scrypt par défaut.
- **Sessions** de 180 jours, prolongées à chaque utilisation : avec des campagnes espacées de plusieurs mois, une session plus courte forcerait à se reconnecter à chaque campagne.
