# Envoyer les billets O’Dream Beach avec Gmail

L’envoi par Gmail est facultatif. Les billets PDF restent téléchargeables sans ce service. La connexion organisateur passe par Supabase Auth ; Gmail sert uniquement à l’expédition des billets aux participants.

## Créer le script Google

1. Connectez-vous à `hichamelkebdani123@gmail.com` sur [Google Apps Script](https://script.google.com/home/projects), puis créez un projet nommé « O’Dream Beach billets ».
2. Copiez le contenu de `google-apps-script/Code.gs` dans `Code.gs` et enregistrez.
3. Créez un secret aléatoire dans PowerShell :

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Dans **Paramètres du projet → Propriétés du script**, ajoutez `ODREAM_SHARED_SECRET` avec ce secret.
5. Exécutez la fonction `verifierAutorisation` et autorisez l’accès Gmail demandé par Google. Cette fonction vérifie les autorisations sans envoyer de message.
6. Dans **Déployer → Nouveau déploiement → Application Web**, choisissez **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde**. Copiez l’URL se terminant par `/exec`.

Le script exige le secret pour accepter une demande d’envoi. Gardez le projet Apps Script et le secret privés.

## Configurer l’application

En local, ajoutez dans `.env.local` :

```text
APPS_SCRIPT_WEB_APP_URL="https://script.google.com/macros/s/VOTRE_DEPLOIEMENT/exec"
APPS_SCRIPT_SHARED_SECRET="LE_MEME_SECRET_ALEATOIRE"
```

Sur Vercel, ajoutez les deux valeurs dans **Project Settings → Environment Variables**, puis redéployez. Le secret reste côté serveur. Il ne doit pas être préfixé par `NEXT_PUBLIC_` ni ajouté dans Git.

## Tester

Dans l’application, renseignez la date et le tarif, inscrivez votre propre adresse email comme participant test, confirmez un paiement test, puis envoyez le billet. Vérifiez Gmail **Messages envoyés** et la boîte de réception. Un billet marqué « Transmis » n’est pas renvoyé automatiquement.

Si l’envoi échoue ou reste incertain, vérifiez les exécutions Apps Script et les messages envoyés avant de réessayer. Le statut « Transmis » signifie que Google a accepté la demande ; la livraison finale n’est pas suivie ici. Vérifiez les [quotas Apps Script](https://developers.google.com/apps-script/guides/services/quotas) avant un envoi massif.
