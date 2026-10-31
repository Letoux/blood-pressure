# Blood Pressure

Suivi personnel de l'automesure tensionnelle selon la règle du 3-3-3, pour un foyer et ses proches sur une instance auto-hébergée. Le nom anglais entre parenthèses est celui à utiliser dans le code.

## Mesures

**Mesure** (`Measurement`) :
Un relevé unique : pression systolique, pression diastolique (en mmHg), pouls et horodatage, avec un commentaire facultatif.
_Éviter_ : relevé, prise, lecture

**Créneau** (`Slot`) :
Un moment de mesure d'une campagne, identifié par son jour (J1 à J3) et son moment (matin ou soir). Il attend 3 mesures.
_Éviter_ : session, prise

**Créneau rempli** :
Un créneau qui contient au moins une mesure. Un créneau rempli ne déclenche plus de rappel.

**Mesure libre** (`FreeMeasurement`) :
Une mesure saisie en dehors de toute campagne. Elle est affichée à part et n'entre jamais dans les moyennes de campagne.
_Éviter_ : mesure isolée, mesure ponctuelle

**Protocole** :
Les consignes de bonne mesure : au repos, assis depuis 5 minutes, sans café ni tabac depuis 30 minutes, le matin avant le petit-déjeuner et les médicaments, le soir avant le coucher.

## Campagnes

**Campagne** (`Campaign`) :
Une série de 3 jours consécutifs de 6 créneaux, soit 18 mesures attendues, qui suit la règle du 3-3-3.
_Éviter_ : série, session, cycle

**Fréquence** :
L'intervalle, en mois (1 à 12, 3 par défaut), entre le début d'une campagne et le début prévu de la suivante.

**Campagne planifiée** :
Une campagne dont la date de début prévue n'est pas encore passée et qui n'a encore aucune mesure.

**Campagne en cours** :
Une campagne qui a reçu sa première mesure et dont les 3 jours ne sont pas écoulés. Son début réel est le jour de sa première mesure.

**Campagne terminée** :
Une campagne dont les 3 jours sont écoulés et qui contient au moins une mesure.

**Campagne incomplète** :
Une campagne terminée qui contient moins de 18 mesures. Elle reste valable, mais elle est signalée avec son nombre de mesures (par exemple 14/18) et la liste de ses créneaux manquants.

**Campagne manquée** :
Une campagne planifiée dont la période est passée sans aucune mesure.

**Moyenne de campagne** :
La moyenne arithmétique de toutes les mesures présentes dans la campagne, sans écarter le premier jour (méthode SFHTA). On calcule aussi la moyenne du matin et la moyenne du soir.

## Interprétation

**Référentiel** (`Guideline`) :
La recommandation de société savante choisie par l'utilisateur (SFHTA, ESH, ACC/AHA…). Elle fixe le seuil.
_Éviter_ : norme, standard

**Seuil** (`Threshold`) :
Les valeurs systolique et diastolique d'automesure à partir desquelles le référentiel parle d'hypertension (par exemple 135/85 pour la SFHTA).

**Valeur d'alerte** :
Une mesure à 180/110 ou plus. Elle déclenche un avertissement à la saisie, sans bloquer l'enregistrement.

**Compte rendu** (`Report`) :
La synthèse des campagnes sur une période (dernière campagne, 1 an, 5 ans, tout), destinée au médecin. Elle peut s'imprimer.
_Éviter_ : rapport, bilan

## Rappels

**Rappel** (`Reminder`) :
Une notification push envoyée à l'heure choisie pour un créneau, ou la veille du début d'une campagne.

**Relance** :
Un second rappel, facultatif, pour un créneau toujours pas rempli au bout du délai choisi.

## Personnes

**Utilisateur** (`User`) :
La personne qui mesure sa propre tension. Un compte correspond à une seule personne.
_Éviter_ : patient, membre

**Admin** :
Le compte d'administration, défini par le `.env`. Il gère les utilisateurs mais n'a jamais accès à leurs mesures.
_Éviter_ : superutilisateur
