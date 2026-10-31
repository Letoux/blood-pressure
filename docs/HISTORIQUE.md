# Historique des choix : architecture et métier

Ce document raconte **pourquoi** l'application est comme elle est. Il décrit le contexte, les contraintes et les arbitrages de sa conception, en octobre 2026, pour qu'un développeur qui arrive plus tard ne « corrige » pas un choix délibéré et sache quoi revoir quand le contexte change.

Les décisions unitaires sont dans `docs/adr/` (format court, une par fichier), et le vocabulaire dans `GLOSSARY.md`. Ce document les relie et raconte l'histoire. La spec de la v1 est l'issue GitHub #1, découpée en tickets (#2 à #15).

---

## 1. Le contexte de départ (octobre 2026)

### Le besoin

Le point de départ est un besoin personnel : suivre sa tension artérielle et celle de ses proches selon la **règle du 3-3-3**, recommandée en France par la SFHTA et l'Assurance Maladie :

- 3 mesures le matin et 3 le soir ;
- pendant 3 jours consécutifs ;
- à refaire régulièrement, en général tous les 3 mois.

Jusque-là, les mesures étaient notées sur papier. Les problèmes concrets étaient d'oublier la prochaine série, de rater des créneaux, et de ne rien avoir de lisible à montrer au médecin.

### Les utilisateurs visés

Un foyer et ses proches, sur une instance **auto-hébergée** par une personne technique, qui fait déjà tourner d'autres services chez elle (Jellyfin, etc.) derrière **Nginx Proxy Manager**. Ce n'est **pas** un produit grand public. Cette contrainte explique la plupart des choix qui suivent.

### Les contraintes de l'époque

- **Les données de santé** : en France, héberger des données de santé pour des tiers, dans le cadre d'un service, relève de la certification **HDS** et de l'article 9 du RGPD. Une instance privée pour sa famille échappe à cette lourdeur. On a donc assumé le périmètre « auto-hébergé familial » (ADR-0001), en gardant de bonnes pratiques : export, suppression de compte, aucune donnée inutile.
- **Les notifications sur mobile** : en 2026, le Web Push fonctionne sur Android et sur ordinateur. Sur **iOS**, il ne fonctionne que si la PWA est **installée sur l'écran d'accueil** (iOS 16.4 ou plus) et servie en **HTTPS**. Ça a pesé sur le choix de la PWA et sur le parcours du premier lancement.
- **Pas d'infrastructure mail** : l'instance n'envoie pas de mail en v1. Il n'y a donc ni « mot de passe oublié » ni vérification d'email, d'où le rôle de l'admin.
- **Un dépôt public** : le code est sur un repo GitHub public (`Letoux/blood-pressure`) et les images sont publiées sur GHCR. Aucun secret ne doit être commité : `.env` est ignoré par git, `.env.template` est public, et gitleaks tourne en CI.

---

## 2. Les décisions métier

### 2.1 La campagne comme unité centrale

Le domaine tourne autour de la **campagne** : 3 jours, 6 **créneaux**, 18 **mesures** attendues. La **fréquence** se règle de 1 à 12 mois, 3 par défaut. Certains suivent la règle mensuellement à la demande de leur médecin.

La campagne suivante est planifiée à partir du **début** de la précédente, pas de sa fin. Une campagne commence réellement le jour de sa **première mesure**, pas forcément à la date prévue : dans la vraie vie, on commence en retard.

### 2.2 Souplesse plutôt que rigueur (ADR-0006)

On a hésité entre deux approches :
- n'autoriser la saisie que dans un créneau d'une campagne active (strict) ;
- tout accepter et signaler ce qui manque (souple).

**Nous avons choisi la souplesse.** Une campagne incomplète reste valable, mais elle est **signalée partout** : 14/18, créneaux manquants « J2 soir ». La raison : le médecin doit avoir *toute* l'information, y compris ce qui manque, plutôt que de perdre des mesures réelles pour une question de forme. Les **mesures libres** (hors campagne) sont acceptées mais n'entrent jamais dans les moyennes.

### 2.3 La moyenne suit la SFHTA (ADR-0005)

La moyenne d'une campagne porte sur **toutes les mesures présentes**, comme le dit la fiche SFHTA/CNAM : « divisez par 18 ».

D'autres recommandations (ESH, NICE) **écartent le premier jour**, mais leur protocole va jusqu'à 7 jours. Si on vous demande de « corriger » le calcul pour écarter J1, vérifiez d'abord que l'application ne suit plus la SFHTA.

### 2.4 Pas de diagnostic (ADR-0008)

L'application **situe** la tension par rapport au seuil, sans **diagnostiquer**. Elle dit si une moyenne est sous ou au-dessus du seuil du référentiel choisi, avec la mention « Ne remplace pas un avis médical ».

Elle ne calcule aucun objectif selon l'âge ou le sexe : les objectifs de traitement (JSH, NICE…) dépendent de l'âge, mais ils sont fixés **au cas par cas par le médecin**. Le sexe et l'âge ont été envisagés pour des « seuils d'alerte personnalisés » puis abandonnés, car aucun référentiel ne fait varier le seuil de diagnostic d'automesure selon ces critères.

La **valeur d'alerte** (180/110) affiche un avertissement sans bloquer la saisie : une mesure réelle, même inquiétante, doit pouvoir être enregistrée.

### 2.5 La comparaison par pays, abandonnée (ADR-0007)

L'idée de départ était d'afficher la « tension moyenne du pays » sur le graphique, avec un sélecteur de pays à recherche instantanée. Les recherches d'octobre 2026 ont montré que :

- la seule source avec systolique **et** diastolique moyennes par pays et par sexe est **NCD-RisC (Lancet 2017)**, et ses **données s'arrêtent en 2015** ;
- NCD-RisC 2021 (données jusqu'en 2019) ne donne que la **part de personnes hypertendues** ;
- IHME GBD 2023 ne donne que la systolique, et seulement via une requête manuelle avec compte ;
- l'API de l'OMS (GHO) reprend les données NCD-RisC et était indisponible pendant les recherches.

Comparer une mesure de 2026 à une moyenne de 2015 n'avait pas de sens, et l'objectif réel, « me situer par rapport aux recommandations », était mieux servi autrement. On a gardé un **référentiel** choisi dans les réglages, dont le seuil est tracé sur les graphiques. **Si une source récente avec systolique et diastolique moyennes par pays apparaît, ce choix mérite d'être reconsidéré.**

### 2.6 Les référentiels et leurs seuils

En 2026, presque tous les référentiels d'automesure convergent sur **135/85** : SFHTA/HAS, ESH 2023, ESC 2024, ISH 2020, NICE, JSH. Les exceptions sont **ACC/AHA** (USA) et **Hypertension Canada 2025**, à **130/80**. Le défaut est la **SFHTA**, cohérent avec la règle du 3-3-3. Les valeurs sont codées en dur dans une table, avec l'explication de chaque sigle. **Elles évoluent avec les recommandations : vérifiez-les à chaque nouvelle édition.**

### 2.7 Un compte, une personne

Chaque proche a son propre compte. On a écarté pour la v1 le cas « je saisis pour mon parent âgé depuis mon compte » : un compte qui gère plusieurs patients complique les droits, l'export et le compte rendu.

---

## 3. Les décisions d'architecture

### 3.1 PWA plutôt qu'app native (ADR-0002)

Une seule base de code web, installable, avec le Web Push pour les rappels. Le prix à payer est la contrainte iOS (installation obligatoire pour recevoir les notifications), d'où un premier lancement qui guide l'installation. Une app native reste possible plus tard.

### 3.2 Stack (ADR-0009)

Next.js, oRPC avec TanStack Query, Postgres, Drizzle et better-auth : c'est le choix du porteur du projet, sur une stack TypeScript de bout en bout.

**better-auth** a été retenu parce qu'il couvre trois besoins à la fois :
- l'authentification par email et mot de passe dès maintenant ;
- un plugin admin ;
- l'OAuth prévu plus tard (Google, Facebook, GitHub, X).

Le hachage est en **argon2id**, choisi explicitement à la place du scrypt par défaut de better-auth.

Les **sessions durent 180 jours** et se prolongent à chaque utilisation. Une durée de 30 jours a été jugée trop courte : avec des campagnes espacées de 3 mois, on aurait dû se reconnecter à chaque campagne.

### 3.3 Un worker séparé et Postgres comme file de tâches (ADR-0003)

Les rappels exigent un processus qui se réveille à heure fixe. On a écarté :
- un **cron dans Next.js**, fragile au redémarrage et inadapté au serverless ;
- **Redis avec BullMQ**, un service de plus à héberger et à sauvegarder pour un usage familial.

Le choix final :
- un service `worker` qui tourne sur la **même image** que l'app ;
- une file **pg-boss** stockée dans Postgres ;
- des clés VAPID générées automatiquement et stockées en base.

Résultat : une seule base de données à sauvegarder, et rien à configurer pour le push.

### 3.4 Un admin à la Jellyfin (ADR-0004)

L'admin vient du `.env`, comme dans les services auto-hébergés que l'utilisateur connaît déjà.

- Il **ne voit jamais les mesures**, et c'est imposé par l'API, pas seulement par l'interface.
- Faute de mail, c'est lui qui réinitialise les mots de passe. Le changement de mot de passe est ensuite **proposé** à l'utilisateur, pas imposé : c'est un choix explicite du porteur du projet.
- L'inscription libre est désactivée par défaut.

### 3.5 Saisie en ligne uniquement (ADR-0010)

La synchronisation hors ligne (file d'attente, conflits) a été jugée trop coûteuse pour un usage où l'on mesure chez soi, avec du réseau. Hors ligne, l'app affiche un avertissement et le formulaire conserve son brouillon.

### 3.6 Déploiement et livraison

- **Docker compose** : services `app`, `worker`, `db` et `backup`. Le HTTPS est géré **hors** du compose, par le reverse proxy existant (Nginx Proxy Manager).
- **Sauvegarde** : un `pg_dump` quotidien avec 14 jours de rétention. Ce sont des données de santé familiales, qu'on ne veut pas perdre.
- **Release** : sur un tag `vX.Y.Z`, une image **amd64 et arm64** est publiée sur GHCR (pour les serveurs maison sur Raspberry Pi), puis une GitHub Release est créée avec le compose et le `.env.template`.

---

## 4. Ce qui a été volontairement reporté

| Sujet | Pourquoi ce n'est pas dans la v1 | Ce qui a été préparé |
|---|---|---|
| OAuth (Google, Facebook, GitHub, X) | Pas indispensable pour un foyer | better-auth le prend en charge nativement |
| Notifications et réinitialisation par mail | Pas d'infrastructure mail | Le modèle `notification` a un champ « canal » |
| Synchronisation avec un agenda externe (ICS ou Google) | Le planning interne suffit pour commencer | La planification est dans un module de domaine pur |
| App native | La PWA suffit | Une API oRPC typée, réutilisable |
| Comparaison par pays | Données trop anciennes (voir 2.5) | — |
| Ouverture au public | HDS et RGPD | Export et suppression de compte déjà présents |

---

## 5. Les signaux pour revoir ces choix

- **L'instance s'ouvre à des personnes hors du cercle familial** : revoir ADR-0001 (HDS, RGPD, consentement, journal d'accès).
- **Apple change sa politique sur le Web Push** : revoir le parcours d'installation, voire ADR-0002.
- **Une recommandation majeure change son seuil d'automesure** : mettre à jour la table des référentiels.
- **La SFHTA change de méthode de calcul** (par exemple, écarter J1) : revoir ADR-0005.
- **Une source récente de tension moyenne par pays devient disponible** : revoir ADR-0007.
- **Un besoin de saisie fréquente hors connexion apparaît** : revoir ADR-0010.
