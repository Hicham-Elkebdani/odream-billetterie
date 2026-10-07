# O’Dream Beach — billetterie AEI

Application privée de billetterie pour la journée d’intégration **ENIAD BERKANE → Saïdia**. Elle gère les inscriptions, les paiements en espèces, les billets PDF avec QR code, les contrôles par activité, les annulations, les remboursements et l’export CSV.

Le billet utilise le modèle **Élégance littorale** et le logo AEI fourni. Les activités Football et Volley-ball sont proposées par défaut ; l’organisateur peut les modifier dans **Paramètres → Points de contrôle du QR code**. Le programme apparaît aussi sur le PDF.

## Architecture

- Next.js 16 et React 19, déployables sur Vercel.
- Supabase Auth pour la connexion par email et mot de passe.
- PostgreSQL Supabase pour les données, accessible uniquement depuis le serveur Next.js.
- Accès organisateur limité à `hichamelkebdani123@gmail.com` par défaut ; `ORGANIZER_EMAILS` permet de définir une liste séparée par des virgules.
- Les tables `event_settings`, `tickets` et `checkins` ont RLS activé et aucun accès direct pour les rôles `anon` ou `authenticated`. Le serveur vérifie le compte organisateur avant chaque accès.
- Les QR contiennent un secret aléatoire de 192 bits. Une contrainte unique empêche deux validations au même point ; une fonction PostgreSQL verrouille la capacité lors de l’inscription.

## 1. Créer le projet Supabase

1. Créez un projet sur [Supabase](https://supabase.com/dashboard). Conservez le mot de passe de la base dans votre gestionnaire de mots de passe.
2. Ouvrez **SQL Editor → New query**, collez le contenu de [`supabase/001_initial.sql`](supabase/001_initial.sql), puis exécutez-le une fois. La base commence vide.
3. Dans **Authentication → Users**, ajoutez l’utilisateur `hichamelkebdani123@gmail.com` avec un mot de passe fort. Vous n’avez pas besoin d’envoyer ce mot de passe à un développeur. L’application ne propose pas d’inscription publique.
4. Dans **Connect** (ou **Settings → API Keys**), copiez l’URL du projet et la clé **publishable** (`sb_publishable_...`).
5. Dans **Connect → Transaction pooler**, copiez l’URI PostgreSQL. Remplacez `[YOUR-PASSWORD]` par le mot de passe de la base. Si le mot de passe contient `@`, `:`, `/`, `#`, `?` ou `%`, encodez ces caractères dans l’URI. Utilisez l’hôte et le nom d’utilisateur fournis par Supabase, sans les inventer.

La clé publishable peut être présente dans le navigateur. Le mot de passe et `DATABASE_URL` restent secrets et ne doivent jamais être préfixés par `NEXT_PUBLIC_`.

## 2. Configurer le projet local

Installez Node.js 22.13 ou plus récent et pnpm, puis exécutez `pnpm install` dans ce dossier. Copiez `.env.example` vers `.env.local` et remplissez les trois valeurs Supabase. `.env.local` est ignoré par Git.

```powershell
pnpm install
pnpm dev
```

Ouvrez `http://localhost:3000/login`, connectez-vous, puis complétez la date, l’heure, le tarif et le programme dans **Paramètres**. Les paiements confirmés exigent une date et un tarif.

## 3. Déployer sur Vercel

1. Placez ce projet dans un dépôt Git privé ou contrôlé par votre équipe, puis importez-le dans [Vercel](https://vercel.com/new).
2. Choisissez le préréglage **Next.js**. Les commandes `pnpm build` et `pnpm start` utilisent Next.js directement.
3. Dans **Project Settings → Environment Variables**, ajoutez `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` et, si vous voulez la rendre explicite, `ORGANIZER_EMAILS=hichamelkebdani123@gmail.com` pour Production, Preview et Development selon vos besoins.
4. Déployez, puis testez la connexion, une inscription, le PDF et les scans à plusieurs points de contrôle.
5. Si vous configurez des emails de confirmation ou de réinitialisation via Supabase Auth, renseignez l’adresse définitive du site dans **Authentication → URL Configuration** et ajoutez les URL de développement et de prévisualisation nécessaires.

Supabase fournit la base et l’authentification ; **Vercel héberge l’application**. L’ancien stockage Cloudflare D1 et l’ancienne authentification ChatGPT Sites ne sont plus utilisés par l’application Next.js. Les anciens fichiers Drizzle/Cloudflare restent dans le dépôt comme historique technique et ne doivent pas être exécutés sur la nouvelle base.

## Billets et emails

Chaque participant reçoit une référence et un QR uniques. Le PDF est disponible après confirmation du paiement en espèces. Le même QR peut être validé une fois pour l’entrée et une fois pour chaque activité configurée. Un billet annulé est refusé.

L’envoi par email est optionnel. Suivez [`INSTALLATION-GMAIL.md`](INSTALLATION-GMAIL.md) pour Gmail Apps Script, ou définissez `RESEND_API_KEY` et `EMAIL_FROM` comme variables serveur Vercel. Ces secrets ne doivent jamais être placés dans le code du navigateur. Le statut « Transmis » signifie accepté par le fournisseur, sans garantie de livraison.

## Vérification

```powershell
pnpm test
pnpm lint
pnpm build
```

Le test du PDF écrit un billet d’exemple dans `tmp/pdfs/`. Pour vérifier la base et l’authentification, il faut renseigner un projet Supabase de test. Ne lancez pas les anciens tests D1 sur la base de production.
