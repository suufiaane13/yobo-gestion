# YOBO Gestion

Application **bureau** (caisse + gestion) pour snack / restauration rapide : **Tauri 2**, **React 19**, **TypeScript**, **Tailwind 4**, **Zustand**. Les données sont stockées localement en **SQLite** (dossier données utilisateur, hors dossier du dépôt).

## Prérequis

- [Node.js](https://nodejs.org/) 20+ (22 recommandé)
- [Rust](https://www.rust-lang.org/tools/install) + dépendances système [Tauri](https://v2.tauri.app/start/prerequisites/) pour `tauri dev` / `tauri build`

## Scripts

| Commande | Rôle |
|----------|------|
| `npm run dev` | Front seul (Vite, port 5173) |
| `npm run tauri:dev` | App desktop avec hot reload |
| `npm run build` | `tsc -b` + build Vite (front) |
| `npm run build:tauri` ou `npx tauri build` | Installeur / exécutable (CLI Tauri) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (tests unitaires) |
| `npm run test:watch` | Vitest en mode watch |
| `npm run debug:doctor` | Diagnostic environnement (voir `scripts/`) |

## Données & sauvegarde

La base **SQLite** est créée automatiquement sous le répertoire données local de l’OS (ex. `%LOCALAPPDATA%\yobo-gestion\yobo.sqlite` sur Windows).

- **Application bureau (Tauri)** : onglet **Profil** (gérant) — *Sauvegarder sous…* / *Restaurer depuis un fichier…* (dialogue système). Après une restauration, **redémarrer l’app** pour recharger toutes les données.
- **Copie manuelle** : tu peux toujours copier `yobo.sqlite` quand l’application est **fermée**, pour éviter les fichiers verrouillés.

**Connexion de démo** (`db.rs`) : identifiant suggéré sur l’écran de login **admin** / **1234** — **à changer ou désactiver en production** (comptes réels, PIN forts).

## Structure utile

- `src/` — interface React, store Zustand, textes client (`lib/yoboClientMessages.ts`)
- `src-tauri/` — commandes Rust, schéma SQL, auth bcrypt
- `src/lib/*.test.ts` — tests Vitest (logique pure : montants, pagination, tailles menu, erreurs affichées)

## Livrable pour l’utilisateur final (Windows)

1. Lance **`npm run release:user-pack`** (ou `.\scripts\build-user-release.ps1`).  
   Cela exécute `npm run build`, `npx tauri build`, puis copie l’installateur NSIS dans  
   **`distribution\YOBO-Gestion-v<version>\`** avec **`LISEZMOI-UTILISATEUR.txt`**.
2. Donne au client **le dossier** ou au minimum le **`.exe`** + la notice texte.

L’installateur se trouve aussi dans `src-tauri\target\release\bundle\nsis\` après un `tauri build` manuel.

## Dépannage

### « localhost a refusé de se connecter » / `ERR_CONNECTION_REFUSED`

L’exécutable dans **`src-tauri\target\debug\`** (build Rust **debug**, ex. après `cargo build` ou `cargo run` dans `src-tauri`) est prévu pour le **mode développement** : la fenêtre charge **`http://localhost:5173`**, donc il faut que **Vite tourne** en parallèle.

- **Pour coder** : à la racine du projet, lance **`npm run tauri:dev`** (ou **`npm run dev`** dans un terminal + **`cargo run`** dans `src-tauri`).
- **Pour tester une vraie app installable (sans serveur)** : **`npm run build:tauri`**, puis ouvre **`src-tauri\target\release\yobo-gestion.exe`** ou l’installateur dans **`target\release\bundle\nsis\`** — pas le `.exe` du dossier **`debug`**.

Un build **debug** mais **avec l’interface embarquée** : **`npx tauri build --debug`** (l’exe sera sous `target\debug\bundle\…`, pas seulement `target\debug\yobo-gestion.exe` nu selon la config).

## CI

Le workflow GitHub Actions `.github/workflows/ci.yml` exécute **lint**, **tests** et **build** front sur chaque push / PR vers `main` ou `master`.

## Licence

Projet privé (`private` dans `package.json`). Adapter selon ton usage.
