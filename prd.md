# Cahier des Charges — Système de Gestion YOBO
**Version** : 1.0  
**Date** : Mars 2026  
**Statut** : Confirmé  
**Auteur** : Soufiane (avec assistance Claude / Anthropic)

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Objectifs](#2-objectifs)
3. [Stack technique](#3-stack-technique)
4. [Rôles & accès](#4-rôles--accès)
5. [Modules fonctionnels](#5-modules-fonctionnels)
   - 5.1 [Authentification & login](#51-authentification--login)
   - 5.2 [Dashboard gérant](#52-dashboard-gérant)
   - 5.3 [Caisse POS (Point de Vente)](#53-caisse-pos-point-de-vente)
   - 5.4 [Gestion du menu (CRUD)](#54-gestion-du-menu-crud)
   - 5.5 [Historique des commandes](#55-historique-des-commandes)
   - 5.6 [Gestion des utilisateurs](#56-gestion-des-utilisateurs)
   - 5.7 [Logs d'activité](#57-logs-dactivité)
   - 5.8 [Rapports & statistiques](#58-rapports--statistiques)
   - 5.9 [Gestion de caisse](#59-gestion-de-caisse)
   - 5.10 [Calculateur de monnaie](#510-calculateur-de-monnaie)
   - 5.11 [Modifier / annuler une commande](#511-modifier--annuler-une-commande)
   - 5.12 [Mode sombre / clair](#512-mode-sombre--clair)
   - 5.13 [Sauvegarde & export](#513-sauvegarde--export)
6. [Schéma de base de données](#6-schéma-de-base-de-données)
7. [Architecture du projet](#7-architecture-du-projet)
8. [Non-inclus (hors scope v1)](#8-non-inclus-hors-scope-v1)

---

## 1. Présentation du projet

**Yobo** est une application desktop de gestion de snack, développée avec **Tauri (Rust) + React + TypeScript + Tailwind CSS**. Elle fonctionne entièrement en local sans serveur externe, avec une base de données **SQLite** embarquée.

Le snack propose : pizzas, burgers, paninis, crêpes, boissons, et desserts — chaque produit disposant de plusieurs tailles et prix configurables.

L'application est destinée à deux types d'utilisateurs : le **gérant** (accès total) et le **caissier** (accès restreint à la caisse et à l'historique).

---

## 2. Objectifs

- Digitaliser la prise de commande et la caisse du snack
- Offrir au gérant une visibilité complète sur l'activité (stats, logs, rapports)
- Simplifier la gestion du menu (ajout, modification, suppression de produits et catégories)
- Tracer toutes les actions utilisateurs pour audit et sécurité
- Fonctionner sans connexion internet (application desktop offline-first)
- Être rapide, intuitive et adaptée à un usage quotidien intensif

---

## 3. Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework desktop | Tauri 2.x (Rust) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| État global | Zustand |
| Base de données | SQLite via `rusqlite` (Rust) |
| Communication | `invoke()` Tauri (React → Rust) |
| Export | `csv` + `pdf` via Rust/Node |
| Build | Vite |

---

## 4. Rôles & accès

### Gérant (`role = "gerant"`)
Accès complet à tous les modules :

- Dashboard
- Caisse POS
- Gestion du menu (CRUD + catégories)
- Historique des commandes
- Gestion des utilisateurs
- **Logs d'activité**
- **Rapports & statistiques**
- **Gestion de caisse**
- Mode sombre / clair
- Sauvegarde & export

### Caissier (`role = "caissier"`)
Accès restreint :

- Caisse POS (avec calculateur de monnaie)
- Historique (ses propres commandes)
- **Modifier / annuler une commande** (dans la limite de temps)
- Mode sombre / clair

---

## 5. Modules fonctionnels

---

### 5.1 Authentification & login

**Description** : Écran de connexion au démarrage de l'application.

**Fonctionnalités :**
- Sélection du rôle (Gérant / Caissier) avec interface visuelle
- Connexion par PIN ou nom d'utilisateur + mot de passe (géré en SQLite)
- Session persistante pendant la durée d'utilisation
- Déconnexion manuelle depuis la topbar
- Redirection automatique vers les modules autorisés selon le rôle

**Règles métier :**
- Le gérant peut créer/modifier les comptes caissiers
- Un caissier ne peut pas accéder aux modules réservés au gérant (protection côté Rust + React)
- Toute connexion est enregistrée dans les logs

---

### 5.2 Dashboard gérant

**Description** : Vue d'ensemble en temps réel de l'activité du snack.

**Indicateurs (KPI) affichés :**
- Chiffre d'affaires du jour (MAD)
- Nombre de commandes du jour
- Ticket moyen
- Nombre de caissiers actifs

**Sections :**
- Liste des 5 dernières commandes avec statut
- Top 5 des produits les plus vendus du jour
- Résumé de la caisse (solde ouverture / fermeture)

**Règles métier :**
- Données calculées en temps réel depuis SQLite
- Accessible uniquement par le gérant

---

### 5.3 Caisse POS (Point de Vente)

**Description** : Interface principale de prise de commande pour le caissier.

**Fonctionnalités :**
- Navigation par catégories : Pizza, Burger, Panini, Crêpes, Boissons, Desserts
- Affichage des produits en grille (emoji + nom + fourchette de prix)
- Sélection de taille via modal (S / M / L / XL ou autre selon le produit)
- Ajout au panier avec mise à jour dynamique du total
- Suppression d'un article du panier
- Annulation complète de la commande en cours
- Validation de commande → enregistrement en base + affichage résumé

**Règles métier :**
- Un produit désactivé par le gérant n'apparaît pas en caisse
- Le total se calcule automatiquement à chaque modification du panier
- Toute commande validée est horodatée et associée au caissier connecté
- Une commande validée déclenche l'enregistrement dans l'historique

**Données de la commande enregistrée :**
- ID unique auto-incrémenté
- Date et heure
- Caissier (user_id)
- Liste des articles (produit + taille + prix unitaire)
- Total TTC
- Statut : `validée` | `annulée` | `modifiée`

---

### 5.4 Gestion du menu (CRUD)

**Description** : Module réservé au gérant pour gérer l'ensemble du catalogue produits et des catégories.

#### Produits

**Fonctionnalités :**
- Lister tous les produits avec filtrage par catégorie et recherche par nom
- Ajouter un produit (emoji, nom, description courte, catégorie, tailles+prix)
- Modifier un produit existant
- Supprimer un produit (avec confirmation)
- Activer / désactiver un produit (toggle visible en caisse ou non)

**Champs d'un produit :**
| Champ | Type | Obligatoire |
|-------|------|-------------|
| emoji | string (1 char) | Oui |
| nom | string | Oui |
| description | string | Non |
| catégorie | FK → categories | Oui |
| tailles | JSON array [{label, prix}] | Min 1 |
| actif | boolean | Oui (défaut: true) |

#### Catégories

**Fonctionnalités :**
- Lister les catégories avec compteur de produits
- Ajouter une catégorie (emoji + nom)
- Supprimer une catégorie (uniquement si elle ne contient aucun produit)
- Réordonner les catégories (drag & drop)

**Catégories par défaut :**
- 🍕 Pizza — tailles : S / M / L / XL
- 🍔 Burger — tailles : S / M / L
- 🥪 Panini — tailles : Normal / Maxi
- 🥞 Crêpes — tailles : Simple / Double
- 🥤 Boissons — tailles : 25cl / 50cl
- 🍰 Desserts — tailles libres

---

### 5.5 Historique des commandes

**Description** : Liste complète des commandes passées, avec filtres et détail.

**Fonctionnalités :**
- Liste des commandes (ID, articles, total, caissier, heure, statut)
- Filtres : par date (aujourd'hui / semaine / mois / plage personnalisée), par caissier, par statut
- Recherche par ID de commande
- Détail d'une commande au clic (articles, tailles, prix unitaires, total)

**Accès :**
- Gérant : voit toutes les commandes de tous les caissiers
- Caissier : voit uniquement ses propres commandes

---

### 5.6 Gestion des utilisateurs

**Description** : Module de gestion des comptes (réservé gérant).

**Fonctionnalités :**
- Lister les utilisateurs avec rôle, date de création, nombre de commandes
- Ajouter un utilisateur (nom, rôle, PIN ou mot de passe)
- Modifier les informations d'un utilisateur
- Activer / désactiver un compte caissier
- Le compte gérant principal ne peut pas être supprimé

**Règles métier :**
- Un seul gérant actif à la fois (ou plusieurs selon config)
- Mot de passe haché en Rust avant stockage (bcrypt ou argon2)

---

### 5.7 Logs d'activité

**Description** : Journal complet de toutes les actions effectuées dans le système, visible uniquement par le gérant.

**Actions enregistrées :**

| Catégorie | Actions tracées |
|-----------|----------------|
| Auth | Connexion, déconnexion, échec de connexion |
| Commandes | Création, modification, annulation |
| Menu | Ajout produit, modification, suppression, activation/désactivation |
| Catégories | Ajout, suppression |
| Utilisateurs | Création, modification, activation/désactivation |
| Caisse | Ouverture, fermeture, écart détecté |
| Système | Export effectué, sauvegarde déclenchée |

**Informations d'un log :**
- Timestamp (date + heure précise)
- Utilisateur concerné (nom + rôle)
- Type d'action
- Description détaillée (ex: "Produit 'Double Smash' désactivé")
- Données avant/après pour les modifications (JSON diff)

**Fonctionnalités de la page :**
- Liste chronologique (du plus récent au plus ancien)
- Filtres : par type d'action, par utilisateur, par plage de dates
- Recherche texte libre
- Export des logs en CSV

**Règles métier :**
- Les logs sont en lecture seule (immuables)
- Conservation minimale : 90 jours
- Accessible uniquement au gérant

---

### 5.8 Rapports & statistiques

**Description** : Tableau de bord analytique pour le gérant avec graphiques et KPIs.

**Sections :**

#### Ventes
- CA total par jour / semaine / mois (graphique en barres)
- Évolution du nombre de commandes sur la période
- Ticket moyen par période
- Heure de pointe (heatmap des commandes par heure)

#### Produits
- Top 10 des produits les plus vendus (quantité + CA généré)
- Produits les moins vendus (alertes inactivité)
- Répartition des ventes par catégorie (camembert)

#### Caissiers
- CA par caissier sur la période
- Nombre de commandes par caissier
- Commandes annulées par caissier

**Fonctionnalités :**
- Sélecteur de période : aujourd'hui / 7 jours / 30 jours / plage personnalisée
- Export du rapport en PDF ou CSV
- Impression directe

---

### 5.9 Gestion de caisse

**Description** : Module de suivi du flux d'argent physique en caisse.

**Flux de travail :**

1. **Ouverture de caisse** (début de journée ou de shift)
   - Saisie du fond de caisse initial (en MAD)
   - Horodatage de l'ouverture
   - Nom du caissier ou du gérant qui ouvre

2. **En cours de journée**
   - Suivi en temps réel : fond initial + total des ventes validées
   - Solde théorique affiché en permanence

3. **Fermeture de caisse** (fin de journée ou de shift)
   - Saisie du montant réellement compté en caisse
   - Calcul automatique de l'écart (positif ou négatif)
   - Commentaire optionnel sur l'écart
   - Rapport de fermeture généré et enregistré

**Alertes :**
- Écart détecté > seuil configurable → notification + log automatique
- Caisse non fermée depuis plus de 24h → alerte au gérant

**Historique des sessions de caisse :**
- Date, caissier, montant ouverture, montant fermeture, écart, commentaire

---

### 5.10 Calculateur de monnaie

**Description** : Outil intégré à la caisse pour aider le caissier à calculer la monnaie à rendre.

**Fonctionnement :**
- Après validation d'une commande, affichage du total dû
- Le caissier saisit le montant remis par le client
- Calcul automatique de la monnaie à rendre
- Affichage clair : "Client donne : 100 MAD → Monnaie à rendre : 15 MAD"

**Intégration :**
- Accessible directement depuis le modal de confirmation de commande
- Peut aussi être ouvert indépendamment comme calculatrice

**Règles métier :**
- Si le montant remis est inférieur au total, affichage d'une alerte rouge "Montant insuffisant"
- Le calcul ne s'enregistre pas (outil aide à la caisse uniquement)

---

### 5.11 Modifier / annuler une commande

**Description** : Possibilité de corriger une commande déjà validée dans un délai limité.

#### Annulation

**Fonctionnalités :**
- Annuler une commande validée
- Saisie obligatoire d'un motif d'annulation (liste : erreur de saisie, client annulé, produit indisponible, autre)
- La commande passe au statut `annulée` dans l'historique
- L'annulation est enregistrée dans les logs avec le motif

**Règles métier :**
- Délai d'annulation : 10 minutes après validation (configurable par le gérant)
- Le gérant peut annuler sans limite de temps
- Annulation impossible si la caisse est fermée sur cette session

#### Modification

**Fonctionnalités :**
- Modifier les articles d'une commande validée (ajouter / supprimer un article)
- Recalcul automatique du total
- La commande passe au statut `modifiée`
- La version originale est conservée dans les logs (historique des versions)

**Règles métier :**
- Délai de modification : 5 minutes après validation
- Le gérant peut modifier sans limite de temps

---

### 5.12 Mode sombre / clair

**Description** : Bascule entre thème sombre et thème clair pour le confort visuel.

**Fonctionnalités :**
- Bouton de toggle accessible depuis la topbar
- Mémorisation de la préférence par utilisateur (stockée en SQLite)
- Application instantanée sans rechargement
- Thème par défaut : sombre (adapté à un usage en snack avec lumière variable)

**Règles métier :**
- Le mode s'applique à toute l'interface (Tauri window + React)
- Compatible dark mode natif de l'OS (détection automatique au premier lancement)

---

### 5.13 Sauvegarde & export

**Description** : Outils de protection des données et d'export pour usage externe.

#### Sauvegarde

**Fonctionnalités :**
- Sauvegarde manuelle de la base SQLite (copie du fichier `.db`)
- Sauvegarde automatique planifiée (quotidienne, configurable)
- Destination de sauvegarde configurable (dossier local ou clé USB)
- Historique des sauvegardes avec date et taille du fichier

#### Export des données

| Données exportables | Format |
|---------------------|--------|
| Historique des commandes | CSV + PDF |
| Rapport de ventes (période) | PDF |
| Logs d'activité | CSV |
| Menu complet | CSV |
| Rapports de caisse | PDF |

**Fonctionnalités :**
- Sélection de la période avant export
- Choix du format (CSV ou PDF)
- Ouverture du dossier de destination après export
- Impression directe possible depuis l'application

**Règles métier :**
- Export uniquement accessible au gérant
- Le nom du fichier inclut automatiquement la date (ex: `yobo_commandes_2026-03-19.csv`)

---

## 6. Schéma de base de données

### Table `users`
```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('gerant', 'caissier')),
  password    TEXT NOT NULL,  -- hashé bcrypt/argon2
  active      INTEGER DEFAULT 1,
  theme       TEXT DEFAULT 'dark',
  created_at  TEXT DEFAULT (datetime('now'))
);
```

### Table `categories`
```sql
CREATE TABLE categories (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  label    TEXT NOT NULL,
  emoji    TEXT NOT NULL,
  position INTEGER DEFAULT 0
);
```

### Table `products`
```sql
CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  emoji       TEXT NOT NULL DEFAULT '🍽️',
  category_id INTEGER NOT NULL REFERENCES categories(id),
  sizes       TEXT NOT NULL,  -- JSON: [{"label":"M","price":95}, ...]
  active      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
```

### Table `orders`
```sql
CREATE TABLE orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  items      TEXT NOT NULL,   -- JSON: [{product_id, name, size, price}, ...]
  total      REAL NOT NULL,
  status     TEXT DEFAULT 'validated' CHECK(status IN ('validated','cancelled','modified')),
  cancel_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Table `logs`
```sql
CREATE TABLE logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  action_type TEXT NOT NULL,  -- 'auth' | 'order' | 'menu' | 'caisse' | 'system'
  action      TEXT NOT NULL,
  description TEXT,
  meta        TEXT,           -- JSON diff ou données supplémentaires
  created_at  TEXT DEFAULT (datetime('now'))
);
```

### Table `cash_sessions`
```sql
CREATE TABLE cash_sessions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  opening_amount REAL NOT NULL,
  closing_amount REAL,
  theoretical    REAL,
  gap            REAL,
  comment        TEXT,
  opened_at      TEXT DEFAULT (datetime('now')),
  closed_at      TEXT
);
```

---

## 7. Architecture du projet

```
yobo/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── Auth/                 # Login, ProtectedRoute
│   │   ├── Dashboard/            # KPIs, résumé activité
│   │   ├── Caisse/               # POS, Panier, CalculateurMonnaie
│   │   ├── Menu/                 # CRUD produits & catégories
│   │   ├── Historique/           # Liste commandes, filtres
│   │   ├── Users/                # Gestion utilisateurs
│   │   ├── Logs/                 # Journal d'activité
│   │   ├── Rapports/             # Stats & graphiques
│   │   ├── Caisse/               # Gestion de caisse
│   │   ├── Settings/             # Mode sombre, sauvegarde, export
│   │   └── shared/               # Topbar, Sidebar, Modal, Toast...
│   ├── store/                    # Zustand (auth, cart, theme)
│   ├── hooks/                    # useInvoke, useLogs, useCart...
│   ├── types/                    # TypeScript interfaces
│   └── main.tsx
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Entrypoint Tauri
│   │   ├── db.rs                 # Init SQLite, migrations
│   │   ├── models.rs             # Structs Rust (User, Product, Order...)
│   │   ├── commands/
│   │   │   ├── auth.rs           # login, logout
│   │   │   ├── products.rs       # CRUD produits
│   │   │   ├── categories.rs     # CRUD catégories
│   │   │   ├── orders.rs         # créer, modifier, annuler commande
│   │   │   ├── logs.rs           # écrire & lire logs
│   │   │   ├── reports.rs        # stats & rapports
│   │   │   ├── cash.rs           # sessions de caisse
│   │   │   └── export.rs         # CSV / PDF / backup
│   │   └── lib.rs
│   └── tauri.conf.json
│
└── package.json
```

---

## 8. Non-inclus (hors scope v1)

Les fonctionnalités suivantes sont identifiées mais exclues de la version 1 :

| Fonctionnalité | Raison |
|----------------|--------|
| Impression ticket thermique | Dépend du matériel (imprimante POS) |
| Gestion des tables / plan de salle | Complexité additionnelle |
| Écran cuisine (KDS) | Nécessite un second écran |
| Application mobile caissier | Hors périmètre desktop |
| Synchronisation cloud / multi-poste | Architecture plus complexe |
| Gestion des stocks / ingrédients | Phase 2 du projet |
| Programme de fidélité client | Phase 2 |

---

*Document généré dans le cadre du projet YOBO — Snack Management System*  
*Stack : React + TypeScript + Tailwind CSS + Tauri (Rust) + SQLite*