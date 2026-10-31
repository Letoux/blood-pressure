# L'admin vient du .env et n'a pas accès aux mesures

L'admin est un compte à part dont les identifiants viennent du `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), sur le modèle de Jellyfin. Il crée, désactive et supprime des utilisateurs, révoque leurs sessions et réinitialise leurs mots de passe. Il ne peut **jamais** lire leurs mesures, ni par l'interface ni par l'API.

Comme il n'y a pas d'envoi de mail en v1, la réinitialisation par l'admin remplace le « mot de passe oublié ». Après une réinitialisation, l'app propose à l'utilisateur de changer son mot de passe, sans l'imposer. L'inscription libre est désactivée par défaut.
