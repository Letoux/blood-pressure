# Le mobile passe par une PWA, sans app native

Le mobile est couvert par une PWA (Serwist) installable sur l'écran d'accueil, et non par React Native ou Flutter. On garde ainsi une seule base de code, et le Web Push suffit pour les rappels. La contrepartie : sur iOS, les notifications ne fonctionnent que si la PWA est installée (iOS 16.4 ou plus) et servie en HTTPS. Le premier lancement guide donc l'utilisateur pour l'installer.
