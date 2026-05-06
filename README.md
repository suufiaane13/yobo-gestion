# YOBO

Application **bureau Windows** de caisse et de gestion pour snack / restauration rapide : encaissement, catalogue, historique, utilisateurs et journaux. Stack : **Tauri 2**, **React 19**, **TypeScript**, **Vite 8**, **Tailwind 4**, **Zustand 5**. Les données vivent en **SQLite** local (hors dépôt Git).

---

## Fonctionnalités (aperçu)

| Zone | Contenu |
|------|---------|
| **Caisse** | Session caisse, panier, types de commande, ticket cuisine / client |
| **Menu** | Catalogue (catégories, produits, tailles, tarifs) selon rôle |
| **Historique** | Sessions fermées, commandes, filtres, exports CSV / PDF |
| **Profil & admin** | Compte, thème, sauvegardes base, tickets, mises à jour |
| **Données** | SQLite utilisateur ; sauvegarde / restauration depuis l’app (gérant) |

L’interface et les messages utilisateur sont en **français**.

---

## Prérequis

| Outil | Détail |
|-------|--------|
| **Node.js** | 20+ (22 recommandé) |
| **Rust** | Stable + prérequis [Tauri v2](https://v2.tauri.app/start/prerequisites/) |
| **Windows** | Cible principale du bundle NSIS |

---

## Démarrage rapide

```bash
git clone <url-du-depot> yobo && cd yobo
npm install
npm run tauri:dev
```

Le front seul (sans shell natif) : `npm run dev` → http://localhost:5173

---

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Vite seul (port 5173) |
| `npm run tauri:dev` | Application desktop avec rechargement à chaud |
| `npm run build` | `tsc -b` + build Vite (`dist/`) |
| `npm run build:tauri` | Build production + installateur Tauri (NSIS) |
| `npm run release:user-pack` | Build front + Tauri, puis paquet utilisateur sous `distribution/` (voir ci‑dessous) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (une fois) |
| `npm run test:watch` | Vitest en watch |
| `npm run debug:doctor` | Diagnostic environnement (voir `scripts/`) |
| `npm run icons:generate` | Régénérer les icônes à partir de `src-tauri/icons/512x512.png` |

---

## Qualité avant commit / PR

À faire passer localement après une modification non triviale :

```bash
npm run lint
npm run test
npm run build
```

Le workflow **GitHub Actions** (`.github/workflows/ci.yml`) enchaîne lint, tests et build front sur les branches configurées.

---

## Données & confidentialité

- **Emplacement** : base **SQLite** créée automatiquement dans le dossier données local de l’OS (ex. `%LOCALAPPDATA%\yobo-gestion\yobo.sqlite` sous Windows).
- **Sauvegarde / restauration** : onglet **Profil** (gérant) — dialogues système. Après restauration, **redémarrer l’application**.
- **Copie manuelle** : arrêter YOBO puis copier `yobo.sqlite` pour éviter un fichier verrouillé.

**Compte de démo** (initialisation `db.rs`) : suggestions affichées au login — **à changer en production** (PIN forts, comptes réels).

**Clés de signature des mises à jour** : ne pas commiter les fichiers privés listés dans `.gitignore` (`*.key`, etc.).

---

## Livrable utilisateur (Windows)

1. Exécuter **`npm run release:user-pack`** (équivalent `scripts/build-user-release.ps1`).
2. Récupérer le dossier **`distribution/YOBO-Gestion-v<version>/`** : installateur **`.exe`** + **`LISEZMOI-UTILISATEUR.txt`**.
3. Sans script : après `npm run build:tauri`, l’installateur NSIS est aussi sous  
   `src-tauri/target/release/bundle/nsis/`.

---

## Structure du dépôt

| Chemin | Rôle |
|--------|------|
| `src/` | UI React, Zustand, messages (`lib/yoboClientMessages.ts`), tests `*.test.ts` |
| `src-tauri/` | Rust, commandes Tauri, schéma SQLite, bundle NSIS |
| `scripts/` | Build release, assets installeur, debug |
| `distribution/` | Notice utilisateur ; dossiers versionnés ignorés par Git (voir `.gitignore`) |
| `netlify-updates/` | Site statique optionnel (mises à jour / docs déploiement) |

---

## Dépannage

### `ERR_CONNECTION_REFUSED` / localhost

Un `.exe` issu d’un build **debug** non packagé peut charger `http://localhost:5173` : il faut **`npm run dev`** en parallèle. Pour une app **autonome**, utiliser **`npm run build:tauri`** et lancer l’installateur ou l’exe sous **`target/release/`**, pas uniquement le binaire **`target/debug/`** nu.

### Build Tauri

Les artefacts lourds (`src-tauri/target/`, `dist/`, `node_modules/`) ne sont pas versionnés.

---

## Licence

Projet **private** (`package.json`). Adapter selon ton usage.
