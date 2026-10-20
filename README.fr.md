# CFRouter — Passerelle IA compatible OpenAI, routeur LLM & répartiteur de charge pour Cloudflare Workers

> **Routez, proxifiez, répartissez la charge et gérez plusieurs fournisseurs d'IA via un point d'entrée unique compatible OpenAI — une passerelle LLM auto-hébergée, déployée sur le réseau edge de Cloudflare en quelques minutes.**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120.svg)](https://workers.cloudflare.com)
[![Docs](https://img.shields.io/badge/docs-English-blue.svg)](README.md)
[![Docs FA](https://img.shields.io/badge/docs-فارسی-green.svg)](README.fa.md)
[![Docs FR](https://img.shields.io/badge/docs-Français-purple.svg)](README.fr.md)
[![Docs AR](https://img.shields.io/badge/docs-العربية-orange.svg)](README.ar.md)
[![Docs ES](https://img.shields.io/badge/docs-Español-red.svg)](README.es.md)
[![Contact](https://img.shields.io/badge/contact-info%40barivan.com-0b7285.svg)](mailto:info@barivan.com)

**Lire dans :** [English](README.md) · [فارسی](README.fa.md) · [Français](README.fr.md) · [العربية](README.ar.md) · [Español](README.es.md)

> 🌍 **Cette documentation existe en cinq langues.** L'anglais fait référence et suit toujours la
> dernière version ; les traductions française, persane, arabe et espagnole couvrent les mêmes
> chapitres : installation, référence API, connexion des agents de code, configuration et
> sécurité. En cas de divergence, le texte anglais prévaut.

---

## 📑 Sommaire

| Section | Description |
|---------|-------------|
| [Qu'est-ce que CFRouter ?](#quest-ce-que-cfrouter-) | Présentation du projet |
| [Installation](#-installation) | Un clic, CLI ou dashboard — choisissez votre voie |
| [Démarrage rapide (CLI)](#-démarrage-rapide) | Option B — pour les développeurs à l'aise avec le terminal |
| [Installation via le dashboard Cloudflare](#️-installation-via-le-dashboard-cloudflare-sans-cli) | Option C — déploiement via l'interface web uniquement |
| [Fonctionnalités](#-fonctionnalités) | Liste complète des fonctionnalités |
| [Référence API](#-référence-api) | Documentation des endpoints |
| [Connecter un agent de code](#-connecter-un-agent-de-code) | Configuration Claude Code, Cline, Continue |
| [Configuration](#-configuration) | Réglages avancés |
| [Sécurité](#-modèle-de-sécurité) | Authentification, secrets et bonnes pratiques |
| [Développement](#️-développement) | Guide de développement local |
| [Questions fréquentes](#-questions-fréquentes) | Gratuit ? Comparé à LiteLLM ? Clés ? Équipes ? |
| [Contact](#-contact) | E-mail, issues, divulgation de sécurité |

---

## Qu'est-ce que CFRouter ?

CFRouter est une **passerelle API d'IA auto-hébergée** construite comme un unique Cloudflare Worker. Elle agit comme **reverse proxy** et **répartiteur de charge** pour des fournisseurs de LLM comme OpenAI, Anthropic, Google Gemini et toute API compatible OpenAI — vous offrant un point d'entrée unifié pour toutes vos charges de travail IA.

Si vous construisez avec des **agents IA** (VSCode Copilot, Cline, Continue, Cursor), exécutez des **applications propulsées par LLM** ou gérez **plusieurs clés API** entre fournisseurs, CFRouter vous offre une couche de routage propre, observable et économique sur le réseau edge mondial de Cloudflare.

Voyez-le comme un routeur LLM auto-hébergé qui vous appartient de bout en bout : aucune passerelle tierce dans le chemin de la requête, aucune marge sur les tokens, et vos clés de fournisseurs restent dans votre propre base Cloudflare D1. C'est une alternative open source (MIT) aux passerelles IA hébergées et à l'exploitation en solo de LiteLLM, OpenRouter ou d'un proxy façon Portkey — avec basculement automatique, rotation des clés API, appels d'outils et analytique d'usage intégrés. Un seul fichier Worker, un `wrangler deploy`, et tous les modèles auxquels vous avez accès répondent sur une unique URL compatible OpenAI.

### À quoi ça sert

- **Agents de code** — pointez Claude Code, Cline, Continue, Cursor ou VS Code Copilot vers une seule URL de base, au lieu de coller des clés de fournisseurs dans chaque outil.
- **Répartition multi-fournisseurs** — étalez vos chat completions sur OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, Groq ou votre propre serveur vLLM, avec sélection de clé round-robin, least-used ou séquentielle.
- **Survie aux limites de débit et aux pannes** — un `429`, `401` ou `5xx` d'un fournisseur est retenté en transparence sur le suivant : vos agents et vos applications continuent de tourner.
- **Passerelle d'équipe** — donnez à chaque développeur ou application son propre token `sk-`, puis suivez l'usage de tokens et le coût par clé et par modèle dans le dashboard.
- **Déploiement edge** — un Worker, une base D1, rien à patcher ; le proxy tourne dans le réseau Cloudflare, au plus près de vos utilisateurs.
- **Traduction de dialectes** — appelez Claude via l'API OpenAI, ou Gemini via l'API Messages d'Anthropic : la passerelle traduit requête et réponse dans les deux sens, streaming compris.

### Une passerelle, zéro serveur

- **Aucun serveur à payer ni à patcher** — tout le routeur tient dans un Worker plus une base D1,
  et l'offre gratuite Cloudflare suffit généralement pour une équipe.
- **Un routeur pour tous vos projets** — pointez toutes vos applis, scripts et agents vers la même
  passerelle au lieu d'éparpiller vos clés de fournisseurs entre les projets.
- **Vos clés, gérées au centre** — les clés fournisseurs restent dans votre D1 ; distribuez des
  tokens `sk-` révocables par appli, développeur ou client, avec un usage suivi par token.
- **Plus de quota grâce au round-robin multi-clés** — attachez plusieurs clés par fournisseur et
  choisissez la stratégie `round-robin` (ou `least-used`) ; la passerelle répartit les requêtes
  entre elles, et la limite de débit n'est plus un plafond à clé unique.

### Fonctionnement

```
Votre client (agent, app, curl)
        │
        │  POST /v1/chat/completions   {"model": "openai/gpt-4o", ...}
        ▼
┌───────────────────────────────┐
│        CFRouter Worker        │  ← Edge Cloudflare, près de vos utilisateurs
│  ┌─────────────────────────┐  │
│  │ Traduction de dialectes │  │  Anthropic / Gemini ←→ OpenAI
│  │ Routage (slug/modèle)   │  │  fournisseur choisi par slug
│  │ Sélection de clé        │  │  round-robin / random / least-used / sequential
│  │ Basculement auto       │  │  ignore les fournisseurs en panne, réessaie le suivant
│  │ Suivi d'usage           │  │  par clé, par modèle, par jour
│  └─────────────────────────┘  │
└───────────┬───────────┬───────┘
            ▼           ▼
      Fournisseur A   Fournisseur B …   ← vos clés API, vos comptes
            │
     Cloudflare D1 (analytique)
```

Les trois dialectes de requête (OpenAI, Anthropic, Gemini) sont traduits vers un
format interne unique, routés vers le fournisseur nommé, puis renvoyés en
streaming dans le dialecte attendu par votre client.

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| **API compatible OpenAI** | Remplacement direct de l'API OpenAI — fonctionne avec tout client parlant le protocole `/v1/chat/completions` |
| **Trois dialectes API** | Messages API Anthropic native sur `/v1/messages`, API Gemini native sur `/v1beta/models/…`, plus OpenAI — une passerelle pour tous les clients |
| **Appels d'outils** | Function/tool calling complet sur les trois dialectes, en streaming et non-streaming — ce qu'exigent les agents de code |
| **Prêt pour Claude Code** | `/v1/messages`, `/v1/messages/count_tokens` et auth `x-api-key` — définissez `ANTHROPIC_BASE_URL` et c'est parti |
| **Répartition multi-fournisseurs** | Routage `slug/modèle` entre un nombre illimité de fournisseurs, chacun avec plusieurs clés API |
| **4 stratégies de clés** | `round-robin`, `random`, `least-used`, `sequential` — configurable par fournisseur |
| **Basculement automatique** | Erreur `401/403/429/5xx` d'un fournisseur → nouvel essai transparent sur le suivant ; erreurs définitives (`400/404/422`) échouent vite |
| **Dashboard d'administration** | Interface web à 7 onglets : analytique, santé, fournisseurs, modèles, playground, tokens, docs |
| **Catalogue de 79 fournisseurs** | Presets en un clic : labos frontier, hébergeurs d'inférence, passerelles, régionaux, entreprise et médias |
| **Playground** | Discutez avec n'importe quel modèle depuis le dashboard — streaming, system prompt, temperature, `max_tokens`, `top_p` |
| **Curation des modèles** | Masquez des modèles de la liste publique `/models`, un par un ou en masse — les modèles masqués restent appelables, vos clients existants ne cassent jamais |
| **Suivi d'usage** | Analytique de tokens par clé et par modèle dans Cloudflare D1 |
| **Support du streaming** | Streaming SSE complet avec transformation transparente entre dialectes |
| **Surveillance santé** | État de santé temps réel des fournisseurs et disponibilité des endpoints |
| **CORS activé** | Prêt pour les apps IA navigateur — en-têtes custom Anthropic, Gemini et OpenAI autorisés |
| **Suppression du reasoning** | Champs `reasoning_content` (Qwen3 e.a.) retirés automatiquement pour les clients sensibles |
| **Déploiement zéro-config** | Un seul fichier, une commande `wrangler deploy` |

---

## 💿 Installation

Choisissez la voie qui vous convient — les trois mènent à la même passerelle :

| Voie | Idéale pour | Détails |
|---|---|---|
| **A. Déploiement en un clic** | Le plus rapide : ni terminal, ni copier-coller | Le bouton Deploy ci-dessous |
| [**B. Démarrage rapide CLI**](#-démarrage-rapide) | Les développeurs qui vivent dans le terminal | Clone + `wrangler deploy` |
| [**C. Dashboard, sans CLI**](#️-installation-via-le-dashboard-cloudflare-sans-cli) | Tout au clic, en plein contrôle | Interface web Cloudflare |

Chaque voie se termine par les mêmes trois étapes : **ajouter un fournisseur → créer un token
passerelle → pointer vos clients vers la passerelle**. Chaque voie est détaillée ci-dessous, une
par une.

### Option A : déploiement en un clic

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)

1. Cliquez sur **Deploy to Cloudflare** — le Worker et sa base D1 sont créés dans votre propre
   compte Cloudflare.
2. Quand on vous le demande, définissez `ADMIN_PASSWORD` et `SESSION_SECRET` (ou sautez les deux
   et visitez `/setup` à la première ouverture — l'assistant les enregistre pour vous).
3. À partir d'ici, toutes les voies convergent : continuez à
   [Étape 8 : Accéder au panneau d'administration](#étape-8--accéder-au-panneau-dadministration) —
   ajoutez un fournisseur, cliquez sur Fetch Models, créez un token sous **Tokens** et envoyez
   votre première requête.

---

## 🚀 Démarrage rapide

> **Option B — la voie CLI.** Vous préférez le clic unique ou pas de terminal ? Utilisez
> [l'option A](#-installation) ou
> [l'option C](#️-installation-via-le-dashboard-cloudflare-sans-cli).

### Prérequis

- [Node.js](https://nodejs.org/) >= 18
- Un [compte Cloudflare](https://dash.cloudflare.com/sign-up) (l'offre gratuite suffit)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### 1. Cloner & installer

```bash
git clone https://github.com/barivanlab/cfrouter.git
cd cfrouter
npm install
```

### 2. Créer la base D1

```bash
wrangler d1 create cfrouter-db
```

Copiez le `database_id` affiché et collez-le dans `wrangler.toml` :

```toml
[[d1_databases]]
binding = "DB"
database_name = "cfrouter-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 3. Définir les secrets

```bash
wrangler secret put ADMIN_PASSWORD
# Saisissez un mot de passe fort (min. 6 caractères)

wrangler secret put SESSION_SECRET
# Saisissez une chaîne aléatoire, min. 16 caractères (p. ex. openssl rand -hex 32)
```

### 4. Déployer

```bash
wrangler deploy
```

Votre passerelle est en ligne sur `https://cfrouter.<your-subdomain>.workers.dev` 🎉

### 5. Configurer votre premier fournisseur

1. Ouvrez `https://cfrouter.<your-subdomain>.workers.dev/admin`
2. Connectez-vous avec le mot de passe défini
3. Cliquez **+ Add Provider** (ou choisissez un preset du catalogue de 79)
4. Saisissez les détails (nom, URL de base, clés API)
5. Cliquez **Fetch Models** pour découvrir les modèles disponibles
6. Sous **Tokens**, créez un token API pour vos clients (commence par `sk-`)

> **Pas de CLI ?** Passez à [Installation via le dashboard](#️-installation-via-le-dashboard-cloudflare-sans-cli) — ou
> visitez simplement `/setup` à la première ouverture pour définir le mot de passe admin dans le navigateur.

---

## 🖥️ Installation via le dashboard Cloudflare (sans CLI)

> Ce guide s'adresse aux utilisateurs préférant déployer entièrement via l'interface web Cloudflare — sans terminal ni Wrangler CLI.

### Prérequis

- Le fichier `src/index.js` de ce projet
- Un éditeur de texte (Notepad, TextEdit, VSCode, etc.)

### Étape 1 : Se connecter à Cloudflare

1. Ouvrez votre navigateur sur [dash.cloudflare.com](https://dash.cloudflare.com)
2. Connectez-vous à votre compte

### Étape 2 : Créer une base D1

1. Dans la barre latérale gauche, cliquez **Workers & Pages**
2. Sélectionnez l'onglet **D1**
3. Cliquez **Create database**
4. Saisissez un nom (p. ex. `cfrouter-db`)
5. Cliquez **Create**
6. ⚠️ **Important :** Copiez le **Database ID** — vous en aurez besoin plus tard

### Étape 3 : Créer un Worker

1. Dans la barre latérale gauche, cliquez **Workers & Pages**
2. Cliquez **Create application**
3. Sélectionnez l'onglet **Workers**
4. Cliquez **Create Worker**
5. Saisissez un nom (p. ex. `cfrouter`)
6. Cliquez **Deploy**

### Étape 4 : Ajouter le code

1. Après création, cliquez **Edit code**
2. Dans l'éditeur en ligne, **supprimez tout** le code par défaut
3. Collez l'intégralité de `src/index.js` de ce projet
4. Cliquez **Save and deploy**

> 💡 **Astuce :** Si vous n'avez pas encore `src/index.js` :
> - Allez sur [github.com/barivanlab/cfrouter](https://github.com/barivanlab/cfrouter)
> - Cliquez **Code** → **Download ZIP**
> - Extrayez l'archive
> - Trouvez `src/index.js` à l'intérieur

### Étape 5 : Connecter la base au Worker

1. Sur la page du Worker, allez à l'onglet **Settings**
2. Trouvez la section **Bindings**
3. Cliquez **Add binding**
4. Sélectionnez **D1 Database**
5. Renseignez :
   - **Variable name :** `DB`
   - **D1 database :** la base créée à l'étape 2 (`cfrouter-db`)
6. Cliquez **Deploy**

### Étape 6 : Définir les variables d'environnement (secrets)

1. Toujours sur la page du Worker, onglet **Settings**
2. Trouvez la section **Variables and Secrets**
3. Cliquez **Add variable**

**Secret 1 — mot de passe admin :**
- **Variable name :** `ADMIN_PASSWORD`
- **Value :** un mot de passe fort
- ✅ Cochez **Encrypt** (important !)
- Cliquez **Add variable**

**Secret 2 — clé de session :**
- Cliquez de nouveau **Add variable**
- **Variable name :** `SESSION_SECRET`
- **Value :** une longue chaîne aléatoire (p. ex. `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- ✅ Cochez **Encrypt**
- Cliquez **Add variable**

> 💡 **Astuce :** Pour générer une chaîne aléatoire, utilisez [random.org/strings](https://www.random.org/strings/) — 32 caractères.

> **Alternative : assistant de configuration** — Si vous sautez cette étape, définissez ces valeurs via l'assistant web sur `/setup` à la première visite.

### Étape 7 : Vérifier que le Worker est en ligne

1. Allez à l'onglet **Triggers** du Worker
2. Trouvez **Domains & Routes**
3. Votre Worker est disponible à une adresse comme `cfrouter.your-subdomain.workers.dev`
4. Testez en ouvrant dans le navigateur :
   ```
   https://cfrouter.your-subdomain.workers.dev/v1/health
   ```

### Étape 8 : Accéder au panneau d'administration

1. Ouvrez dans le navigateur :
   ```
   https://cfrouter.your-subdomain.workers.dev/admin
   ```
2. Connectez-vous avec le mot de passe de l'étape 6

### Étape 9 : Ajouter votre premier fournisseur

1. Cliquez **Providers** dans la barre latérale
2. Cliquez **+ Add Provider**
3. Renseignez :
   - **Name :** ce que vous voulez (p. ex. « OpenAI »)
   - **Base URL :** l'URL de base du fournisseur
     - OpenAI : `https://api.openai.com/v1`
     - Anthropic : `https://api.anthropic.com/v1`
     - Google Gemini : `https://generativelanguage.googleapis.com/v1beta`
   - **API Keys :** vos clés API (une par ligne)
4. Cliquez **Fetch Models** pour découvrir les modèles
5. Cliquez **Save**

### Étape 10 : Créer un token API

1. Cliquez **Tokens** dans la barre latérale
2. Cliquez **+ Create Token**
3. Saisissez un nom (p. ex. « VSCode »)
4. Cliquez **Create Token**
5. ⚠️ **Important :** Copiez le token **maintenant** — il n'est affiché qu'une fois !

### Étape 11 : Tester et utiliser

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Bonjour !"}]
  }'
```

> **Note :** les IDs de modèle utilisent le format `slug/modèle` (voir [Format des IDs](#format-des-ids-de-modèle)).
> `gpt-4o` seul est diffusé à tous les fournisseurs ; `openai/gpt-4o` ne va qu'à OpenAI.

---

### 📋 Référence rapide — étapes d'installation dashboard

| Étape | Action |
|------|--------|
| 1 | Connexion à [dash.cloudflare.com](https://dash.cloudflare.com) |
| 2 | Créer une base D1 → copier le Database ID |
| 3 | Créer un nouveau Worker |
| 4 | Coller le code `src/index.js` dans l'éditeur en ligne |
| 5 | Connecter D1 au Worker (Binding : `DB`) |
| 6 | Définir `ADMIN_PASSWORD` et `SESSION_SECRET` |
| 7 | Vérifier que le Worker est en ligne |
| 8 | Accéder au panneau admin sur `/admin` |
| 9 | Ajouter un fournisseur |
| 10 | Créer un token API |
| 11 | Utiliser l'API |

### ⚠️ Notes importantes

1. **N'oubliez pas votre mot de passe** — sinon il faudra supprimer et recréer le Worker
2. **Copiez votre token** — le token API n'est affiché qu'une fois
3. **Conservez votre Database ID** — utile pour le dépannage
4. **Cochez toujours Encrypt** — pour tous les secrets
5. **Re-déployez après modifications** — après tout changement de Settings

---

## 📖 Référence API

### URL de base

```
https://cfrouter.<your-subdomain>.workers.dev
```

### Authentification

Envoyez votre clé API passerelle dans l'en-tête utilisé par votre client. Les trois sont acceptés :

| En-tête | Utilisé par |
|---|---|
| `Authorization: Bearer YOUR_API_KEY` | SDK OpenAI, Cline, Continue, la plupart des outils |
| `x-api-key: YOUR_API_KEY` | SDK Anthropic, Claude Code |
| `x-goog-api-key` / `?key=` | SDK Gemini |

La clé doit être un token passerelle créé sous **Tokens** (commence par `sk-`) — pas une clé fournisseur.

### Endpoints

| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/models` | token | Lister tous les modèles (IDs `slug/modèle`) |
| `POST` | `/v1/chat/completions` | token | Chat completion (format OpenAI, streaming inclus) |
| `POST` | `/v1/messages` | token | Messages API Anthropic (streaming + outils inclus) |
| `POST` | `/v1/messages/count_tokens` | token | Comptage de tokens, répondu localement |
| `POST` | `/v1beta/models/{model}:generateContent` | token | Format Gemini |
| `POST` | `/v1beta/models/{model}:streamGenerateContent` | token | Format Gemini, streaming |
| `GET` | `/v1/health` | aucune | Check santé public (sans token) |
| `GET` | `/` · `/v1` | aucune | Infos passerelle (endpoints, heure) |
| `GET` | `/docs` | aucune | Documentation API interactive |
| `GET` | `/admin` | mot de passe | Dashboard d'administration |
| *any* | *autres chemins* | token | Transmis tel quel au fournisseur routé (p. ex. `/v1/embeddings`) |

Les trois dialectes sont traduits au format OpenAI et routés vers le fournisseur
nommé : une passerelle sert tous vos clients. Les chemins non listés (p. ex.
`/v1/embeddings`) sont transmis inchangés au fournisseur sélectionné.

### Format des IDs de modèle

Les modèles s'adressent en `slug-fournisseur/nom-modèle` :

```
openai/gpt-4o
anthropic/claude-sonnet-4-20250514
my-proxy/llama-3-8b
```

Le slug est le **slug** du fournisseur dans le dashboard (défaut : nom en
minuscules avec tirets). Tout ce qui suit le premier slash est transmis inchangé,
donc les IDs amont contenant des slashes fonctionnent aussi :

```
openrouter/meta-llama/llama-3.1-70b-instruct
```

Notes de comportement :

- Un `slug/modèle` dont le slug ne matche aucun fournisseur renvoie `404` avec la
  liste des slugs existants — sauf si un fournisseur annonce réellement ce nom à slash.
- Un nom sans slash est **diffusé à tous les fournisseurs activés** en round-robin ;
  le premier succès gagne. Préférez `slug/modèle` pour un routage prévisible.

### Appels d'outils

Le tool use fonctionne sur les trois dialectes, en streaming et non-streaming.
C'est ce qui rend la passerelle utilisable par les agents de code — Claude Code et
Cline pilotent chaque édition de fichier et commande shell via des tool calls.

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/messages \
  -H "x-api-key: sk-your-gateway-token" \
  -H "content-type: application/json" \
  -d '{
    "model": "anthropic/claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "stream": true,
    "tools": [{
      "name": "read_file",
      "description": "Read a file from disk",
      "input_schema": {
        "type": "object",
        "properties": { "path": { "type": "string" } },
        "required": ["path"]
      }
    }],
    "messages": [{ "role": "user", "content": "Read a.txt" }]
  }'
```

### Exemple : chat completion

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "Bonjour !"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### Exemple : streaming

```bash
curl -N -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "stream": true,
    "messages": [{"role": "user", "content": "Compte jusqu’à cinq."}]
  }'
```

### Sémantique des erreurs

Les erreurs conservent le dialecte de la requête, pour des retries SDK corrects :

| Situation | Statut | Corps |
|---|---|---|
| Clé passerelle invalide | `401` | style OpenAI (tous chemins) |
| Slug fournisseur inconnu | `404` | dialecte de la requête + slugs valides |
| Requête invalide partout (`400/404/422`) | transmis | erreur amont inchangée |
| Rejet par **toutes** les cibles (`401/403/429/5xx`) | `400/404/429` transmis, sinon `502` | dialecte de la requête, avec `upstream_status` |
| Aucun fournisseur activé | `503` | dialecte de la requête |

Timeout amont : 120 s par cible.

---

## 🤖 Connecter un agent de code

Pointez votre agent vers la passerelle plutôt que vers le fournisseur. Il vous faut
trois choses, toutes du dashboard :

1. **Base URL** — `https://cfrouter.<your-subdomain>.workers.dev/v1`
2. **API key** — créée sous **Tokens** (commence par `sk-`)
3. **Model** — `slug/modèle`, p. ex. `openai/gpt-4o`

Chaque requête est routée au fournisseur nommé. Si un fournisseur est en panne ou
sa clé rejetée, la passerelle réessaie sur un autre avant d'abandonner.

### Claude Code

Claude Code parle Messages API Anthropic, servie nativement sur `/v1/messages` —
tool use inclus. Définissez :

```bash
export ANTHROPIC_BASE_URL="https://cfrouter.your-subdomain.workers.dev"
export ANTHROPIC_API_KEY="sk-your-gateway-token"
export ANTHROPIC_MODEL="anthropic/claude-sonnet-4-20250514"
```

`ANTHROPIC_BASE_URL` ne prend pas de suffixe `/v1` — Claude Code ajoute
`/v1/messages` lui-même. Lancez ensuite `claude` normalement. Demandez-lui de lire
un fichier : si la réponse revient avec son contenu, le tool calling fonctionne.

> Préférez `ANTHROPIC_API_KEY` à `ANTHROPIC_AUTH_TOKEN`. La première envoie la clé
> dans l'en-tête `x-api-key`, la seconde en `Authorization: Bearer` — la passerelle
> accepte les deux, mais `x-api-key` est l'en-tête attendu par Claude Code.

### Cline

Dans le panneau de réglages Cline :

| Champ | Valeur |
|---|---|
| **API Provider** | OpenAI Compatible |
| **Base URL** | `https://cfrouter.your-subdomain.workers.dev/v1` |
| **API Key** | votre token passerelle `sk-...` |
| **Model ID** | `slug/modèle`, p. ex. `openai/gpt-4o` |

Cline lit `GET /v1/models` pour remplir sa liste déroulante. Tous les modèles de
tous les fournisseurs activés y figurent en `slug/modèle` : choisissez ou tapez à
la main. Modèle manquant ? Réaffichez-le sous **Models** du dashboard.

### Continue

Dans `~/.continue/config.json`, ajoutez sous `models` :

```json
{
  "title": "CFRouter",
  "provider": "openai",
  "model": "openai/gpt-4o",
  "apiBase": "https://cfrouter.your-subdomain.workers.dev/v1",
  "apiKey": "sk-your-gateway-token"
}
```

### Cursor / SDK OpenAI

Tout client acceptant une base URL OpenAI fonctionne — base URL sur
`https://cfrouter.<your-subdomain>.workers.dev/v1`, clé sur votre token passerelle,
modèle en `slug/modèle`.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://cfrouter.<your-subdomain>.workers.dev/v1",
    api_key="sk-your-gateway-token",
)
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Bonjour !"}],
)
print(response.choices[0].message.content)
```

### Chatbots, automatisation et plus (n8n, Hermes, …)

Tout ce qui parle le protocole OpenAI fonctionne pareil — sans infrastructure
supplémentaire :

- **n8n** — dans un nœud OpenAI (ou HTTP Request), définissez la base URL sur
  `https://cfrouter.<your-subdomain>.workers.dev/v1` (ou votre
  [domaine personnalisé](#domaine-personnalisé-optionnel)), le credential sur votre token
  `sk-` et le modèle sur `slug/modèle`.
- **Chatbots et agents façon Hermes** — partout où l'outil demande une base URL OpenAI, une clé
  API et un modèle, collez les mêmes trois valeurs. Streaming et appels d'outils se comportent
  comme OpenAI : vos assistants continuent de marcher sans changement.
- Une seule passerelle sert à la fois agents de code, chatbots et automatisations — chacun avec
  son token, tous mesurés dans le même dashboard.

### Dépannage

| Symptôme | Cause | Correctif |
|---|---|---|
| `401 Invalid API key` | Clé absente ou pas un token passerelle | Utilisez un token **passerelle** de **Tokens** (commence par `sk-`), pas une clé fournisseur |
| `404 Unknown provider slug` | Slug sans fournisseur | L'erreur liste les slugs valides — voir l'onglet **Providers** |
| Agent bloqué, pas de sortie | Réponse streaming incomplète | Vérifiez Base URL et token du fournisseur — testez-le via **Playground** |
| Liste de modèles vide | `/models` du fournisseur injoignable depuis le Worker | Repli sur la liste **Fetch Models** en cache ; relancez-la dans Providers |
| `503 No providers available` | Aucun fournisseur activé | Activez-en un dans **Providers** |

---

## 🔧 Configuration

### Variables d'environnement (secrets)

| Secret | Requis | Description |
|---|---|---|
| `ADMIN_PASSWORD` | oui (ou `/setup`) | Mot de passe du dashboard (min. 6 car.) |
| `SESSION_SECRET` | oui (ou `/setup`) | Clé de signature de session (min. 16 car., hex aléatoire conseillé) |

Via `wrangler secret put ADMIN_PASSWORD` / `SESSION_SECRET`, ou ignorez les deux et
visitez `/setup` à la première ouverture — l'assistant les enregistre.

### Réglages wrangler.toml

```toml
name = "cfrouter"
main = "src/index.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "cfrouter-db"
database_id = "YOUR_DATABASE_ID"
```

### Stratégies de clés (par fournisseur)

Chaque fournisseur choisit une stratégie de rotation de ses clés API :

| Stratégie | Comportement |
|---|---|
| `round-robin` (défaut) | Clés utilisées à tour de rôle — charge répartie |
| `random` | Tirage uniforme par requête |
| `least-used` | Clé au plus faible compteur d'appels (suivi en D1) |
| `sequential` | Toujours la première clé activée — prévisible, idéal en primaire/secours |

Modifiable sur la page détail du fournisseur ; s'applique aux requêtes OpenAI,
Anthropic et Gemini.

### Domaine personnalisé (optionnel)

Donnez à votre passerelle votre propre adresse — et remettez cette adresse à vos clients. Le
routage de Cloudflare place votre domaine devant le Worker : vos clients l'utilisent comme base
URL exactement comme l'adresse `*.workers.dev` par défaut (le TLS est provisionné
automatiquement).

**Via le dashboard Cloudflare (sans fichier de config) :**

1. Ouvrez la page de votre Worker → **Settings → Domains & Routes → Add → Custom Domain**
2. Saisissez p. ex. `api.yourdomain.com` (la zone doit être sur Cloudflare)
3. Utilisez `https://api.yourdomain.com/v1` comme base URL partout où vous utiliseriez l'URL
   `workers.dev`

**Via `wrangler.toml` (une route sur une zone à vous) :**

```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

Puis `wrangler deploy` — les requêtes vers `https://api.yourdomain.com/*` atteignent désormais
ce Worker.

**Servir vos clients sur votre domaine :** créez un token passerelle par client sous **Tokens**
(commence par `sk-`) et remettez à chacun les deux mêmes choses — l'URL de base de votre domaine
et son token. L'usage reste séparé par token dans l'onglet analytics : un seul Worker sur votre
domaine sert tous vos projets et clients, avec une observabilité par client et sans
infrastructure supplémentaire.

### Modèle de données (D1)

La passerelle crée ses tables à la première requête — aucune migration manuelle :

| Table | Usage |
|---|---|
| `custom_providers` | Fournisseurs : nom, slug, URL, clés, stratégie, modèles en cache |
| `api_keys` | Tokens passerelle (hash SHA-256 + préfixe, jamais la clé brute) |
| `token_usage` | Compteurs d'appels par clé (moteur de `least-used`) |
| `usage_summary` | Usage quotidien par token et modèle (analytique) |
| `api_status` | État de santé des fournisseurs |
| `app_settings` | Hash du mot de passe admin, état du setup |

---

## 🔒 Modèle de sécurité

- **Tokens passerelle** stockés en hash SHA-256 — le token brut n'est montré qu'une
  fois à la création. Seul le préfixe `sk-` est conservé pour identification.
- **Clés fournisseurs** dans D1 (stockage edge Cloudflare) ; secrets admin
  (`ADMIN_PASSWORD`, `SESSION_SECRET`) en secrets Worker chiffrés.
- **Sessions** : cookies signés HMAC (expiration 24 h). HTML admin en `Cache-Control: no-store`.
- **Basculement sûr par design :** seules les erreurs définitives échouent vite ;
  les erreurs credential/quota/panne retentent sur le fournisseur suivant.
- **Bonnes pratiques :** `least-used` ou `round-robin` pour ne pas marteler une clé,
  rotation périodique des clés, un token passerelle par client pour une analytique
  pertinente, et jamais de `wrangler.toml` avec un vrai `database_id` dans un fork
  public ne vous appartenant pas.

---

## 🏗️ Architecture

Worker monofichier (`src/index.js`, ~6 600 lignes) — UI admin HTML, routage et
traduction de dialectes dans une unité déployable :

```
cfrouter/
├── src/
│   └── index.js          # La passerelle entière (routes, UI, traduction)
├── wrangler.toml          # Config Worker + binding D1
├── package.json
├── .github/
│   └── workflows/
│       └── ci.yml         # Pipeline de validation + déploiement
├── README.md              # Docs anglaises
├── README.fa.md           # Docs persanes
├── README.fr.md           # Docs françaises (ce fichier)
├── README.ar.md           # Docs arabes
├── README.es.md           # Docs espagnoles
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## 🛠️ Développement

```bash
# Serveur de dev local
npm run dev

# Déploiement production
npm run deploy

# Logs en direct
npm run tail
```

### D1 local

```bash
wrangler d1 create cfrouter-db --local
# collez l'id dans wrangler.toml, puis :
npm run dev
```

Panneau admin : `http://localhost:8787/admin` · Santé : `http://localhost:8787/v1/health`

---

## 🤝 Contribuer

Contributions bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md).
Merci de lire le [Code de conduite](CODE_OF_CONDUCT.md) avant de participer — les corrections de traduction et les nouveaux README de langue comptent autant que le code.
Une question avant de commencer ? Écrivez à [info@barivan.com](mailto:info@barivan.com).

---

## 📄 Licence

Licence MIT — voir [LICENSE](LICENSE).

---

## 🔗 Projets liés

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Anthropic API](https://docs.anthropic.com/en/api/messages)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) · [Cline](https://github.com/cline/cline) · [Continue](https://github.com/continuedev/continue)

---

## ❓ Questions fréquentes

**CFRouter est-il gratuit ?**
Oui. CFRouter est open source sous licence MIT et tourne dans votre propre compte Cloudflare : vous payez Cloudflare (l'offre gratuite suffit en général pour une équipe) plus vos factures de fournisseurs. Aucune marge par requête, aucun abonnement, et aucun service tiers placé dans le chemin de vos requêtes.

**Quelle différence avec LiteLLM, OpenRouter ou Portkey ?**
CFRouter est un unique Cloudflare Worker adossé à sa propre base D1 — rien à héberger, aucun service Python ni conteneur à patcher, aucun compte d'éditeur entre vous et vos fournisseurs. Vous obtenez un routeur compatible OpenAI dans votre compte Cloudflare, avec rotation de clés round-robin, basculement automatique, un catalogue de 79 fournisseurs et un dashboard d'administration pour l'analytique d'usage.

**Puis-je l'utiliser avec Claude Code, Cline, Continue, Cursor ou VS Code Copilot ?**
C'est l'usage principal. Claude Code parle nativement l'API Messages d'Anthropic sur `/v1/messages` ; tous les autres agents compatibles OpenAI se connectent à `/v1` avec un token de passerelle. Les appels d'outils (function calling) fonctionnent sur les trois dialectes, en streaming comme en non-streaming — indispensable aux agents de code pour chaque édition de fichier et chaque commande shell.

**Fonctionne-t-il avec d'autres fournisseurs qu'OpenAI, Anthropic et Gemini ?**
Tout endpoint compatible OpenAI : OpenRouter, Groq, DeepSeek, Together, Fireworks, Cloudflare Workers AI, Azure OpenAI, Snowflake Cortex, Modal, ou un serveur Ollama / vLLM auto-hébergé. Le dashboard embarque 79 presets, et vous pouvez ajouter un fournisseur personnalisé avec l'URL de base, le style d'en-tête et les identifiants compagnons qu'il exige.

**Où vivent mes clés API et mon trafic ?**
Dans votre compte Cloudflare. Les clés de fournisseurs restent dans votre base D1, les tokens de passerelle sont stockés en hachés SHA-256 (le token brut n'est affiché qu'une fois) et les identifiants admin sont des secrets chiffrés du Worker. Les requêtes vont de votre client à votre fournisseur via votre Worker — aucun trafic ni aucune clé ne passe par un serveur que nous contrôlons.

**Puis-je l'exploiter pour une équipe ou plusieurs applications ?**
Oui. Créez un token de passerelle par client dans **Tokens**, choisissez une stratégie de clé par fournisseur (`round-robin`, `random`, `least-used`, `sequential`) et consultez l'onglet analytique pour l'usage par clé et par modèle — pratique pour la refacturation, pour repérer un agent qui s'emballe et pour savoir quel fournisseur sert réellement votre trafic.

**Que se passe-t-il si un fournisseur tombe ou atteint sa limite de débit ?**
Les requêtes qui nomment un fournisseur mort sont retentées en transparence sur le suivant ; seules les erreurs définitives (`400`, `404`, `422`) échouent immédiatement. Une requête sans fournisseur nommé est diffusée en round-robin et garde la première réponse réussie.

**Le streaming est-il pris en charge ?**
Oui — streaming SSE complet sur les dialectes OpenAI, Anthropic et Gemini, avec traduction des réponses entre formats à la volée, appels d'outils streamés compris.

**Puis-je l'utiliser avec des chatbots, n8n ou des agents façon Hermes ?**
Oui — tout ce qui parle le protocole OpenAI se branche avec les mêmes trois valeurs (base URL,
token `sk-`, `slug/modèle`). Une seule passerelle sert à la fois agents de code, chatbots et
automatisations, chacun sur son token, sans infrastructure serveur.

**Puis-je servir mon propre domaine (et mes clients) avec ?**
Oui. Placez votre domaine devant le Worker avec le routage Cloudflare, puis remettez à chaque
client l'URL de base de votre domaine plus un token passerelle (voir
[Domaine personnalisé](#domaine-personnalisé-optionnel)). L'usage reste séparé par token : un
seul Worker sur votre domaine sert tous vos projets et clients.

---

## 📬 Contact

Questions, rapports de bug, corrections de traduction, support commercial et divulgations de sécurité arrivent tous à la même adresse :

- **E-mail :** [info@barivan.com](mailto:info@barivan.com)
- **Issues & demandes de fonctionnalités :** [github.com/barivanlab/cfrouter/issues](https://github.com/barivanlab/cfrouter/issues)
- **Discussions & questions d'usage :** [github.com/barivanlab/cfrouter/discussions](https://github.com/barivanlab/cfrouter/discussions)
- **Sécurité :** avis privé uniquement — voir [SECURITY.md](SECURITY.md), jamais une issue publique
