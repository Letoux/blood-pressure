# Instance auto-hébergée pour un foyer, pas un service public

L'application tourne sur une seule instance, avec `docker compose`, derrière le reverse proxy de l'hébergeur (Nginx Proxy Manager), pour un foyer et ses proches. Ce n'est pas un SaaS. Ce choix écarte les obligations d'un service public de données de santé : hébergement certifié HDS, registre RGPD complet, etc. En contrepartie, l'export CSV et la suppression de compte existent dès la v1, et aucune donnée de santé inutile n'est stockée (ni sexe ni âge). Si l'application est un jour ouverte au public, il faudra revoir cette décision.
