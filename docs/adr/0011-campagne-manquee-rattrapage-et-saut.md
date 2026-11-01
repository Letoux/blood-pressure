# Campagne manquée enregistrée, rattrapage dès le lendemain, campagne sautée

Une campagne peut commencer jusqu'à **7 jours** après sa date prévue (J+0 à J+6) : le jour de la première mesure devient J1. Sans mesure dans cette fenêtre, elle est **manquée**. Ce statut est **enregistré en base** et reste visible dans l'historique, le compte rendu et l'export.

Après une campagne manquée, une **campagne de rattrapage** est planifiée **le lendemain de sa fenêtre**, avec ses rappels. Si elle est manquée à son tour, une autre suit, et ainsi de suite jusqu'à ce qu'une campagne soit faite. L'utilisateur arrête cette boucle avec **« Sauter la campagne »**, possible dès qu'une campagne est en retard (date prévue passée sans mesure) ou de rattrapage. Une campagne **sautée** reste visible, sans compter comme manquée. La suivante est prévue à la date prévue initiale plus la fréquence, ou à la date du saut plus la fréquence si la première est déjà passée.

Une mesure est rattachée à une campagne selon son **horodatage**, quelle que soit la date de saisie : on peut recopier un carnet papier. Une mesure datée de la fenêtre d'une campagne manquée la commence, et ses rattrapages jamais commencés sont abandonnés.

Le **domaine calcule tout cela seul** (`src/domain/campaign.ts`) : la vue est la même que le worker ait enregistré le statut « manquée » ou non. Le worker l'enregistre chaque quart d'heure, de façon idempotente. Le routeur l'enregistre aussi avant de créer une campagne, sans quoi les campagnes manquées seulement calculées disparaîtraient de l'historique.

**Options écartées** :
- Replanifier la suivante à la date de la campagne manquée plus la fréquence (premier choix de la v1). Un oubli faisait perdre 3 mois de suivi, alors que l'utilisateur veut rattraper au plus tôt.
- Un statut « manquée » toujours calculé, jamais enregistré. Une campagne manquée seulement calculée disparaissait de l'historique dès que la suivante était enregistrée.
- Une fenêtre de début limitée aux 3 jours de la période prévue. Une première mesure au 4e jour devenait une mesure libre.
