# L'admin vient du .env et n'a pas accès aux mesures

L'admin est un compte à part dont les identifiants viennent du `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), sur le modèle de Jellyfin. Il crée, désactive et supprime des utilisateurs, révoque leurs sessions et réinitialise leurs mots de passe. Il ne peut **jamais** lire leurs mesures, ni par l'interface ni par l'API.

Comme il n'y a pas d'envoi de mail en v1, la réinitialisation par l'admin remplace le « mot de passe oublié ». Après une réinitialisation, l'app propose à l'utilisateur de changer son mot de passe, sans l'imposer. L'inscription libre est désactivée par défaut.

**Mise en œuvre.** Le rôle admin de better-auth n'a que les droits utilisés par les procédures `admin.*` (créer, lister, désactiver, supprimer, réinitialiser le mot de passe, révoquer les sessions) : ni usurpation d'identité (`impersonate`), ni changement de rôle, d'email ou de profil. Les routes HTTP du plugin admin (`/api/auth/admin/*`) sont toutes fermées ; l'interface passe par le routeur oRPC. Risque résiduel accepté : en réinitialisant un mot de passe, l'admin peut se connecter à la place d'un utilisateur, mais celui-ci s'en aperçoit (sessions révoquées, ancien mot de passe refusé).
