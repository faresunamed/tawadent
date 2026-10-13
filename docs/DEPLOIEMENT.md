# Guide de déploiement pas à pas

Durée prévue : 30 à 45 minutes. Tu as déjà un compte GitHub, Supabase et Vercel.

## 0. Sécurité avant tout

Les clés `sb_secret_...` ont été collées dans une conversation : **considère-les comme compromises**.
Dans Supabase : *Project Settings → API Keys* → régénère la clé secrète. Tu n'en as pas besoin pour cette application.
Si un ancien projet Supabase de test n'est plus utilisé, supprime-le (ses clés ont aussi été exposées).

## 1. Mettre le code sur GitHub

**Cas A — tu as reçu le zip avec le dossier caché `.git` (recommandé).** Décompresse, puis :

```bash
cd tawadent
git push -u origin main
```

**Cas B — le dossier `.git` n'est pas là.** Clone le dépôt vide, copie-y tout le contenu du zip (fichiers cachés compris, comme `.gitignore`), puis :

```bash
git clone https://github.com/faresunamed/tawadent.git
cd tawadent
# (copie ici le contenu du zip)
git add .
git commit -m "Version initiale TawaDent"
git branch -M main
git push -u origin main
```

Si GitHub demande un mot de passe, utilise un *Personal Access Token* (GitHub → Settings → Developer settings) ou GitHub Desktop.

## 2. Préparer Supabase

1. **Base de données** : *SQL Editor → New query* → colle tout le contenu de
   `supabase/migrations/20261013000000_init.sql` → **Run**.
   Vérifie dans *Table Editor* : `zones` contient 15 lignes.
2. **Connexion par email** : *Authentication → Providers → Email* : activé.
   Garde *Confirm email* activé (les dentistes confirment leur adresse).
3. **Code à saisir par les patients** : *Authentication → Email Templates → Magic Link*.
   Remplace le contenu par un texte qui contient le code :

   ```html
   <h2>TawaDent</h2>
   <p>Votre code de connexion : <strong>{{ .Token }}</strong></p>
   <p>Vous pouvez aussi <a href="{{ .ConfirmationURL }}">cliquer ici</a>.</p>
   ```
4. **Adresses autorisées** : *Authentication → URL Configuration*
   - Site URL : `https://tawadent.tn` (au début, mets l'adresse Vercel provisoire)
   - Redirect URLs : `https://tawadent.tn/**`, `https://www.tawadent.tn/**`, `https://*.vercel.app/**`, `http://localhost:3000/**`
5. **Envoi d'emails (important avant le pilote)** : le service d'email par défaut de Supabase est très limité
   (quelques emails par heure) et prévu pour les tests seulement. Configure un SMTP dédié
   (*Authentication → SMTP Settings*) avec un fournisseur comme Resend, Brevo ou Mailgun.
6. **Temps réel** : la migration ajoute la table `requests` à la publication `supabase_realtime`.
   Contrôle dans *Database → Publications*. L'application fonctionne aussi sans, grâce à une interrogation toutes les 2 à 3 secondes.
7. **Récupérer les 2 valeurs publiques** : *Project Settings → API*
   - `Project URL` (https://xxxx.supabase.co)
   - clé **publishable** (`sb_publishable_...`)

## 3. Créer le premier compte admin

1. *Authentication → Users → Add user → Create new user* : ton email + un mot de passe solide, coche *Auto Confirm User*.
2. *SQL Editor* :

   ```sql
   update public.profiles
      set role = 'admin'
    where id = (select id from auth.users where email = 'TON-EMAIL@exemple.com');
   ```
3. Connecte-toi sur `/fr/admin`.

## 4. Déployer sur Vercel

1. Vercel → *Add New → Project* → importe `faresunamed/tawadent`.
2. Framework : *Next.js* (détecté automatiquement). Ne change rien.
3. *Environment Variables* (Production, Preview et Development) :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | l'URL du projet Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clé `sb_publishable_...` |

4. **Deploy**. Chaque `git push` sur `main` redéploie automatiquement.

## 5. Brancher le domaine tawadent.tn

1. Vercel → *Settings → Domains* → ajoute `tawadent.tn` et `www.tawadent.tn`.
2. Chez ton bureau d'enregistrement du .tn, crée les enregistrements DNS **exactement comme Vercel les affiche** (un enregistrement A pour le domaine nu, un CNAME pour `www`).
3. Attends la propagation (de quelques minutes à quelques heures), puis mets à jour la *Site URL* dans Supabase (étape 2.4).

## 6. Test complet avant d'inviter des cabinets (2 téléphones)

- [ ] Dentiste : créer un compte sur `/fr/dentiste`, confirmer l'email, remplir le profil.
- [ ] Admin : valider ce dentiste sur `/fr/admin`.
- [ ] Dentiste : *Me déclarer disponible*.
- [ ] Patient (autre téléphone) : choisir la zone du cabinet, voir le cabinet, demander, saisir le code reçu par email.
- [ ] Dentiste : le bip et la demande apparaissent ; *Accepter*.
- [ ] Patient : voir l'adresse, le bouton *Appeler* et *Itinéraire*.
- [ ] Refaire en laissant expirer 60 s : le patient voit « Pas de réponse » et peut choisir un autre cabinet.
- [ ] Refaire en arabe (`/ar`) : texte de droite à gauche.

## 7. Après la mise en ligne

- Relis et complète les textes légaux (`content/legal.ts`) avec un juriste, et vérifie la déclaration auprès de l'INPDP.
- Ajoute 5 à 10 cabinets partenaires un par un (ils s'inscrivent, tu valides).
- Surveille l'onglet *Activité récente* de l'espace admin.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Message « variables d'environnement manquantes » | Les 2 variables ne sont pas définies sur Vercel : ajoute-les puis redéploie. |
| Le patient ne reçoit pas de code | SMTP par défaut limité : configure un SMTP dédié. Vérifie aussi le dossier spam. |
| Le patient reçoit un lien mais pas de code | Le modèle d'email *Magic Link* ne contient pas `{{ .Token }}` (étape 2.3). |
| « Accès réservé à l'administration » | Le compte n'a pas le rôle admin (étape 3). |
| Un dentiste ne voit pas le bouton de disponibilité | Son profil n'est pas encore validé par l'admin. |
