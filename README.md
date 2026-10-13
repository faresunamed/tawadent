# TawaDent

Plateforme de mise en relation pour les urgences dentaires dans le Grand Tunis.
Un patient choisit sa zone, sélectionne librement un cabinet disponible et envoie une demande ; le cabinet a **60 secondes** pour confirmer. Un dentiste se déclare disponible pour **60 minutes**.

- **Application** : Next.js 15 (React 19, TypeScript), français par défaut + arabe (droite à gauche)
- **Base de données, authentification, temps réel** : Supabase (PostgreSQL)
- **Hébergement** : Vercel
- **Mobile** : application web installable (PWA) sur iPhone et Android, puis applications natives avec Capacitor (voir `docs/MOBILE.md`)

## Les trois espaces

| Espace | Adresse | Connexion |
|---|---|---|
| Patient | `/fr/patient` · `/ar/patient` | Email avec code (sans mot de passe) |
| Dentiste | `/fr/dentiste` · `/ar/dentiste` | Email + mot de passe, profil validé à la main par l'admin |
| Admin | `/fr/admin` · `/ar/admin` | Email + mot de passe (compte créé à la main, voir le guide) |

L'espace admin n'est lié depuis aucun menu : on y accède par son adresse.

## Comment la sécurité est garantie

Le navigateur n'a **aucun droit d'écriture direct** sur les tables. Toute action passe par une fonction SQL qui vérifie le rôle de l'utilisateur :

- Le délai de 60 s est géré **par le serveur** (`expires_at`), pas par l'application.
- Un cabinet ne peut recevoir qu'**une demande à la fois**, un patient qu'**une demande à la fois** (index uniques + verrou de ligne), même en cas de clics simultanés.
- Les coordonnées du cabinet ne sont renvoyées au patient **qu'après acceptation**.
- Limite de 5 demandes par heure et par patient.
- Le rôle `admin` ne peut pas être obtenu depuis l'application.

Tout est décrit dans `supabase/migrations/20261013000000_init.sql` et vérifié par 28 tests.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis remplir les 2 variables publiques
npm run dev                  # http://localhost:3000
```

## Tests

```bash
npm test            # tout
npm run test:unit   # 13 tests : compte à rebours, liens, erreurs, FR/AR, zones
npm run test:db     # 28 tests : le vrai schéma SQL dans un PostgreSQL embarqué
npm run lint        # vérification des types TypeScript
npm run build       # compilation de production
```

Les tests de base de données exécutent la migration réelle et couvrent : double demande, expiration à 60 s, consommation de la disponibilité, suspension, droits par rôle, anti-abus.

## Mise en ligne

Voir **`docs/DEPLOIEMENT.md`** (Supabase, Vercel, domaine tawadent.tn, premier compte admin).

## Règle d'or sur les clés

Seules `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sont utilisées par l'application.
La clé `sb_secret_...` ne doit **jamais** être écrite dans le code, dans GitHub ni dans une conversation.

## Structure

```
app/[locale]/          pages (accueil, patient, dentiste, admin, légal)
components/            en-tête, connexion, notifications
lib/                   i18n FR/AR, client Supabase, zones, utilitaires
content/legal.ts       brouillons de la politique de confidentialité et des conditions
supabase/migrations/   schéma, sécurité, fonctions
tests/                 tests unitaires et tests de base de données
public/                logo provisoire, icônes, manifest, service worker
```
