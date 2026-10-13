# iPhone et Android

Le même code sert pour le web et pour les deux mobiles. Trois niveaux, du plus simple au plus complet.

## Niveau 1 — Application installable (PWA) : déjà prête

Le site fournit déjà un manifest, des icônes et un service worker.

- **Android (Chrome)** : menu ⋮ → *Installer l'application*.
- **iPhone (Safari)** : bouton Partager → *Sur l'écran d'accueil*.

Limites : sur iPhone, les notifications ne fonctionnent que si l'application est ajoutée à l'écran d'accueil, et elles sont moins fiables qu'une app native.
Pour un dentiste, **la notification est critique** (60 secondes pour répondre) : prévoir le niveau 2 avant d'élargir le pilote.

## Niveau 2 — Applications natives avec Capacitor

Capacitor emballe le site dans une vraie application (Google Play, App Store) et donne accès aux notifications push natives.

Approche recommandée : l'application charge le site déployé (`https://tawadent.tn`). Les mises à jour du site sont donc immédiates, sans repasser par les stores.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/push-notifications
npx cap init TawaDent tn.tawadent.app --web-dir=public
```

`capacitor.config.ts` :

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "tn.tawadent.app",
  appName: "TawaDent",
  webDir: "public",
  server: { url: "https://tawadent.tn", cleartext: false },
};
export default config;
```

```bash
npx cap add android && npx cap add ios
npx cap sync
npx cap open android   # Android Studio
npx cap open ios       # Xcode (nécessite un Mac, ou un service de build en ligne)
```

Prérequis comptes : Google Play Developer (environ 25 USD, une fois) et Apple Developer (environ 99 USD par an).
Apple peut refuser une application qui n'est qu'un site emballé : ajouter les notifications push natives et le partage de position/appel aide à justifier une vraie app.

## Niveau 3 — Notifications push pour les dentistes (prochaine étape)

1. Créer un projet Firebase (Cloud Messaging) et lier Android et iOS (clé APNs d'Apple).
2. Table `push_tokens (user_id, token, platform)` dans Supabase, remplie par l'application au démarrage.
3. Une fonction serveur (Supabase Edge Function déclenchée par un *Database Webhook* sur l'insertion dans `requests`) envoie la notification au dentiste concerné.
4. Option de secours : SMS via Twilio pour les cabinets qui ne répondent pas en 20 s.

Le service worker contient déjà le code d'affichage d'une notification push (`public/sw.js`).
