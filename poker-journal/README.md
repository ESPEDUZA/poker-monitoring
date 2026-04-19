# "POKER PRO JOURNAL"

Journal de bord pour transition vers le poker professionnel. Design Off-White · Helvetica · gamification XP.

## ✨ Fonctionnalités

- **Vision** : frise des objectifs 3 ans → 1 mois
- **Objectifs** : 6 horizons avec système d'XP (plus l'horizon est long, plus l'XP gagné est grand)
- **Problèmes & Solutions** : consigner les difficultés et les protocoles (+40 XP par résolution)
- **Objectifs annexes** : 4 piliers (Physique, Mental, Finances, Social) — +25 XP par objectif
- **Tableau mensuel** : sessions, heures, bankroll, taux horaire calculé, notes, archive
- **Système de niveaux** : de "FISH" à "PRO" (8 niveaux)
- **Sauvegarde automatique** dans le navigateur (localStorage)

## 🚀 Déploiement sur Vercel

### Option 1 — Via le site Vercel (plus simple, 2 min)

1. Créez un compte sur [vercel.com](https://vercel.com) (gratuit)
2. Téléversez ce dossier sur GitHub (ou GitLab/Bitbucket)
   - Sur [github.com/new](https://github.com/new), créez un repo (ex : `poker-journal`)
   - Téléversez tous les fichiers de ce dossier
3. Sur Vercel, cliquez **"Add New... → Project"**
4. Importez le repo GitHub
5. Vercel détecte Vite automatiquement → cliquez **Deploy**
6. C'est en ligne en 30 secondes à une URL type `poker-journal-xxx.vercel.app`

### Option 2 — En ligne de commande (CLI)

```bash
# Installer Node.js si ce n'est pas déjà fait (nodejs.org)
# Puis dans ce dossier :

npm install
npm install -g vercel
vercel login
vercel
```

Répondez aux questions (valider les choix par défaut), et l'URL de production sera affichée.

### Option 3 — Tester en local d'abord

```bash
npm install
npm run dev
# Ouvrez http://localhost:5173
```

Pour un build de production local :

```bash
npm run build
npm run preview
```

## 📝 Notes

- Les données sont **stockées dans votre navigateur** (localStorage). Elles ne quittent jamais votre machine.
- Pour synchroniser entre plusieurs appareils, il faudrait ajouter un backend (ex : Supabase, Firebase) — je peux vous aider si besoin.
- L'application est **100% statique** → hébergement gratuit sur Vercel.

## 🎨 Stack

- React 18 + Vite
- Lucide Icons
- Helvetica + JetBrains Mono
- CSS vanilla (pas de framework)
