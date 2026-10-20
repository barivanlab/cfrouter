# CFRouter — OpenAI-Compatible AI Gateway, LLM Router & Load Balancer for Cloudflare Workers

> **Route, proxy, load-balance and manage multiple AI providers through a single OpenAI-compatible endpoint — a self-hosted LLM gateway deployed on Cloudflare's edge network in minutes.**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120.svg)](https://workers.cloudflare.com)
[![Docs](https://img.shields.io/badge/docs-English-blue.svg)](README.md)
[![Docs FA](https://img.shields.io/badge/docs-فارسی-green.svg)](README.fa.md)
[![Docs FR](https://img.shields.io/badge/docs-Français-purple.svg)](README.fr.md)
[![Docs AR](https://img.shields.io/badge/docs-العربية-orange.svg)](README.ar.md)
[![Docs ES](https://img.shields.io/badge/docs-Español-red.svg)](README.es.md)
[![Contact](https://img.shields.io/badge/contact-info%40barivan.com-0b7285.svg)](mailto:info@barivan.com)

**Read this in:** [English](README.md) · [فارسی](README.fa.md) · [Français](README.fr.md) · [العربية](README.ar.md) · [Español](README.es.md)

> 🌍 **This documentation exists in five languages.** English is the canonical version and always
> reflects the latest release; the other four are complete translations of the same install, API,
> agent, configuration and security chapters. See
> [Documentation in other languages](#-documentation-in-other-languages) — and if a translation
> drifts from the English text, the English text wins.

---

## 📑 Table of Contents

| Section | Description |
|---------|-------------|
| [Documentation in other languages](#-documentation-in-other-languages) | This README in 5 languages |
| [What is CFRouter?](#what-is-cfrouter) | Overview, use cases, and how it works |
| [Installation](#-installation) | One-click, CLI or dashboard — pick your path |
| [Quick Start (CLI)](#-quick-start) | Option B — for developers comfortable with the terminal |
| [Install via Cloudflare Dashboard](#️-install-via-cloudflare-dashboard-no-cli-required) | Option C — deploy using only the web interface |
| [Features](#-features) | Full feature list |
| [API Reference](#-api-reference) | Endpoint documentation |
| [Connect a Coding Agent](#-connect-a-coding-agent) | Claude Code, Cline, Continue setup |
| [Configuration](#-configuration) | Advanced settings |
| [Security](#-security-model) | Auth, secrets, and best practices |
| [Development](#️-development) | Local development guide |
| [FAQ](#-faq) | Free? LiteLLM comparison? Keys? Teams? |
| [Contact](#-contact) | Email, issues, security disclosures |

---

## 🌍 Documentation in Other Languages

CFRouter's documentation ships in five languages, so you can read the install walkthrough, the API
reference, the agent setup and the security model in the language you think in:

| Language | README | Notes |
|---|---|---|
| **English** | [README.md](README.md) | Canonical source — updated with every release |
| **Persian** · فارسی | [README.fa.md](README.fa.md) | Full translation, including the dashboard walkthrough |
| **French** · Français | [README.fr.md](README.fr.md) | Full translation |
| **Arabic** · العربية | [README.ar.md](README.ar.md) | Full translation |
| **Spanish** · Español | [README.es.md](README.es.md) | Full translation |

Every translation covers the same chapters: features, CLI and dashboard installation, API reference,
coding-agent setup, key strategies, security and architecture. The English README is the source of
truth when wording differs.

Spotted a mistake in a translation, or want to add another language? Open a PR — see
[CONTRIBUTING.md](CONTRIBUTING.md) — or write to [info@barivan.com](mailto:info@barivan.com).

---

## What is CFRouter?

CFRouter is a **self-hosted AI API gateway** built as a single Cloudflare Worker. It acts as a **reverse proxy** and **load balancer** for LLM providers like OpenAI, Anthropic, Google Gemini, and any OpenAI-compatible API — giving you one unified endpoint for all your AI workloads.

If you're building with **AI agents** (VSCode Copilot, Cline, Continue, Cursor), running **LLM-powered apps**, or managing **multiple API keys** across providers, CFRouter gives you a clean, observable, and cost-effective routing layer on Cloudflare's global edge network.

Think of it as a self-hosted LLM router you own end to end: no third-party gateway in the request
path, no per-token markup, and your provider keys stay in your own Cloudflare D1 database. It is an
open-source (MIT) alternative to hosted AI gateways and to running LiteLLM, OpenRouter or
Portkey-style proxies yourself — with automatic failover, API key rotation, tool calling and
usage analytics built in. One Worker file, one `wrangler deploy`, and every model you have access to
answers on a single OpenAI-compatible URL.

### What people use it for

- **AI coding agents** — point Claude Code, Cline, Continue, Cursor or VS Code Copilot at one base URL instead of pasting provider keys into every tool.
- **Multi-provider load balancing** — spread chat completions across OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, Groq or your own vLLM box, with round-robin, least-used or sequential key selection.
- **Rate-limit and outage survival** — a `429`, `401` or `5xx` from one provider transparently retries against the next enabled one, so agents and apps keep working.
- **Team gateways** — give every developer or app its own `sk-` gateway token, then watch per-key, per-model token usage and cost in the dashboard.
- **Edge deployment** — one Worker, one D1 database, nothing to patch; the proxy runs inside Cloudflare's network, close to your users.
- **Dialect translation** — call Claude over the OpenAI API, or Gemini over the Anthropic Messages API; the gateway translates request and response in both directions, streaming included.

### One gateway, zero servers

- **No server to pay for or patch** — the whole router is one Worker plus one D1 database, and
  the Cloudflare free tier is usually enough for a team.
- **One router for every project** — point all your apps, scripts and agents at the same gateway
  instead of spreading provider keys across projects.
- **Your keys, managed centrally** — provider keys live in your D1; hand out revocable `sk-`
  gateway tokens per app, developer or customer, and watch usage per token.
- **More quota via multi-token round-robin** — attach several tokens per provider and pick the
  `round-robin` (or `least-used`) strategy; the gateway spreads requests across them, so rate
  limits stop being a single-key ceiling.

### How it works

```
Your client (agent, app, curl)
        │
        │  POST /v1/chat/completions   {"model": "openai/gpt-4o", ...}
        ▼
┌───────────────────────────────┐
│        CFRouter Worker        │  ← Cloudflare edge, near your users
│  ┌─────────────────────────┐  │
│  │ Dialect translation     │  │  Anthropic / Gemini → OpenAI
│  │ Routing (slug/model)    │  │  → provider selected by slug
│  │ Token selection         │  │  round-robin / random / least-used / sequential
│  │ Failover                │  │  skip dead providers, retry next
│  │ Usage tracking          │  │  per key, per model, per day
│  └─────────────────────────┘  │
└───────────┬───────────┬───────┘
            ▼           ▼
      Provider A   Provider B …   ← your API keys, your accounts
            │
     Cloudflare D1 (analytics)
```

Three request dialects (OpenAI, Anthropic, Gemini) are translated into one
internal format, routed to the provider you name, and streamed back in the
dialect your client expects.

---

## ✨ Features

| Feature | Description |
|---|---|
| **OpenAI-Compatible API** | Drop-in replacement for OpenAI's API — works with any client that speaks the `/v1/chat/completions` protocol |
| **Three API dialects** | Native Anthropic Messages API at `/v1/messages`, native Gemini API at `/v1beta/models/…`, plus OpenAI — one gateway serves every client |
| **Tool Calling** | Full tool/function calling on all three dialects, streaming and non-streaming — what coding agents need |
| **Claude Code Ready** | `/v1/messages`, `/v1/messages/count_tokens`, and `x-api-key` auth — set `ANTHROPIC_BASE_URL` and go |
| **Multi-Provider Load Balancing** | `slug/model` routing across unlimited providers, each with multiple API keys |
| **4 key strategies** | `round-robin`, `random`, `least-used`, `sequential` — configurable per provider |
| **Companion Credentials** | Providers that need more than a key (`account_id`, resource name, a second header) get those per key — round-robin across accounts, not one provider per account |
| **Automatic Failover** | `401/403/429/5xx` from one provider → transparent retry against the next; terminal errors (`400/404/422`) fail fast |
| **Admin Dashboard** | 7-tab web UI: analytics, health, providers, models, playground, tokens, docs |
| **79-provider catalog** | One-click presets across frontier labs, inference hosts, gateways, regional, enterprise, and media providers |
| **Playground** | Chat with any model from the dashboard — streaming, system prompt, temperature, `max_tokens`, `top_p` |
| **Model Curation** | Hide models from the public `/models` list per model or in bulk — hidden models stay callable, so existing callers never break |
| **Usage Tracking** | Per-key, per-model token usage analytics in Cloudflare D1 |
| **Streaming Support** | Full SSE streaming with transparent response transformation between dialects |
| **Health Monitoring** | Real-time provider health status and endpoint availability |
| **CORS Enabled** | Ready for browser-based AI apps — Anthropic, Gemini, and OpenAI custom headers allowed |
| **Reasoning stripping** | `reasoning_content` fields (Qwen3 et al.) removed automatically for clients that choke on them |
| **Zero-Config Deploy** | Single file, one `wrangler deploy` command |

---

## 💿 Installation

Pick whichever path fits you — all three end with the same gateway:

| Path | Best for | Details |
|---|---|---|
| [**A. One-click Deploy**](#option-a-one-click-deploy) | Fastest: no terminal, no copy-paste | The Deploy button below |
| [**B. CLI Quick Start**](#-quick-start) | Developers who live in the terminal | Clone + `wrangler deploy` |
| [**C. Dashboard, no CLI**](#️-install-via-cloudflare-dashboard-no-cli-required) | Click-only, full control | Cloudflare web UI |

Every path finishes with the same three steps: **add a provider → create a gateway token →
point your clients at the gateway**. Each path is opened up one by one below.

### Option A: One-click Deploy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)

1. Click **Deploy to Cloudflare** — it creates the Worker and its D1 database in your own
   Cloudflare account.
2. When prompted, set `ADMIN_PASSWORD` and `SESSION_SECRET` (or skip both and visit `/setup`
   on first run — the wizard stores them for you).
3. From here every path converges: continue at
   [Step 8: Access the Admin Panel](#step-8-access-the-admin-panel) — add a provider, fetch
   models, create a token under **Tokens**, and send your first request.

---

## 🚀 Quick Start

> **Option B — the CLI path.** Prefer one click or no terminal? Use
> [Option A](#option-a-one-click-deploy) or
> [Option C](#️-install-via-cloudflare-dashboard-no-cli-required) instead.

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is fine)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### 1. Clone & Install

```bash
git clone https://github.com/barivanlab/cfrouter.git
cd cfrouter
npm install
```

### 2. Create D1 Database

```bash
wrangler d1 create cfrouter-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cfrouter-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 3. Set Secrets

```bash
wrangler secret put ADMIN_PASSWORD
# Enter a strong password when prompted (min. 6 characters)

wrangler secret put SESSION_SECRET
# Enter a random string, min. 16 characters (e.g. openssl rand -hex 32)
```

### 4. Deploy

```bash
wrangler deploy
```

Your gateway is live at `https://cfrouter.<your-subdomain>.workers.dev` 🎉

### 5. Configure Your First Provider

1. Open `https://cfrouter.<your-subdomain>.workers.dev/admin`
2. Log in with the password you set
3. Click **+ Add Provider** (or pick a preset from the 79-provider catalog)
4. Enter your provider details (name, base URL, API keys)
5. Click **Fetch Models** to discover available models
6. Under **Tokens**, create an API token for your clients (starts with `sk-`)

> Providers that need a second value per key (Cloudflare account id, Azure resource,
> …) are covered in [Companion credentials](#companion-credentials-per-key).

> **No CLI?** Skip to [Install via Cloudflare Dashboard](#️-install-via-cloudflare-dashboard-no-cli-required) — or simply
> visit `/setup` on first run and set the admin password in the browser.

---

## 🖥️ Install via Cloudflare Dashboard (No CLI Required)

> This guide is for users who prefer to deploy entirely through the Cloudflare web interface — no terminal or Wrangler CLI needed.

### Prerequisites

- The `src/index.js` file from this project
- A text editor (Notepad, TextEdit, VSCode, etc.)

### Step 1: Log in to Cloudflare

1. Open your browser and go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign in to your account

### Step 2: Create a D1 Database

1. In the left sidebar, click **Workers & Pages**
2. Select the **D1** tab
3. Click **Create database**
4. Enter a name (e.g. `cfrouter-db`)
5. Click **Create**
6. ⚠️ **Important:** Copy the **Database ID** — you'll need it later

### Step 3: Create a Worker

1. In the left sidebar, click **Workers & Pages**
2. Click **Create application**
3. Select the **Workers** tab
4. Click **Create Worker**
5. Enter a name for your Worker (e.g. `cfrouter`)
6. Click **Deploy**

### Step 4: Add the Code

1. After creating the Worker, click **Edit code**
2. In the online editor, **delete all** the default code
3. Paste the entire contents of `src/index.js` from this project
4. Click **Save and deploy**

> 💡 **Tip:** If you don't have `src/index.js` yet:
> - Go to [github.com/barivanlab/cfrouter](https://github.com/barivanlab/cfrouter)
> - Click **Code** → **Download ZIP**
> - Extract the archive
> - Find `src/index.js` inside

### Step 5: Connect the Database to Your Worker

1. On your Worker's page, go to the **Settings** tab
2. Find the **Bindings** section
3. Click **Add binding**
4. Select **D1 Database** as the binding type
5. Fill in:
   - **Variable name:** `DB`
   - **D1 database:** Select the database you created in Step 2 (`cfrouter-db`)
6. Click **Deploy**

### Step 6: Set Environment Variables (Secrets)

1. Still on the Worker's page, go to the **Settings** tab
2. Find the **Variables and Secrets** section
3. Click **Add variable**

**Secret 1 — Admin password:**
- **Variable name:** `ADMIN_PASSWORD`
- **Value:** Enter a strong password
- ✅ Check the **Encrypt** box (important!)
- Click **Add variable**

**Secret 2 — Session key:**
- Click **Add variable** again
- **Variable name:** `SESSION_SECRET`
- **Value:** Enter a long random string (e.g. `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- ✅ Check the **Encrypt** box
- Click **Add variable**

> 💡 **Tip:** To generate a random string, use [random.org/strings](https://www.random.org/strings/) — generate a 32-character string.

> **Alternative: Setup Wizard** — If you skip this step, you can set these values through the web-based Setup Wizard at `/setup` on your first visit. The wizard will guide you through creating your admin password and session secret directly in the browser.

### Step 7: Verify Your Worker is Live

1. Go to the **Triggers** tab on your Worker's page
2. Find the **Domains & Routes** section
3. Your Worker is available at an address like `cfrouter.your-subdomain.workers.dev`
4. Test by opening this URL in your browser:
   ```
   https://cfrouter.your-subdomain.workers.dev/v1/health
   ```

### Step 8: Access the Admin Panel

1. Open this URL in your browser:
   ```
   https://cfrouter.your-subdomain.workers.dev/admin
   ```
2. Log in with the password you set in Step 6

### Step 9: Add Your First Provider

1. Click **Providers** in the left sidebar
2. Click **+ Add Provider**
3. Fill in the details:
   - **Name:** Any name you like (e.g. "OpenAI" or "My Anthropic")
   - **Base URL:** The provider's API base URL
     - OpenAI: `https://api.openai.com/v1`
     - Anthropic: `https://api.anthropic.com/v1`
     - Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
   - **API Keys:** Enter your API keys (one per line)
4. Click **Fetch Models** to discover available models
5. Click **Save**

### Step 10: Create an API Token

1. Click **Tokens** in the left sidebar
2. Click **+ Create Token**
3. Enter a name (e.g. "VSCode" or "My App")
4. Click **Create Token**
5. ⚠️ **Important:** Copy the token **now** — it will only be shown once!

### Step 11: Test and Use

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

> **Note:** model IDs use the `slug/model` format (see [Model ID Format](#model-id-format)).
> `gpt-4o` alone broadcasts to every provider; `openai/gpt-4o` routes to OpenAI only.

---

### 📋 Quick Reference — Dashboard Installation Steps

| Step | Action |
|------|--------|
| 1 | Log in to [dash.cloudflare.com](https://dash.cloudflare.com) |
| 2 | Create a D1 database → copy Database ID |
| 3 | Create a new Worker |
| 4 | Paste `src/index.js` code in the online editor |
| 5 | Connect D1 to Worker (Binding: `DB`) |
| 6 | Set `ADMIN_PASSWORD` and `SESSION_SECRET` |
| 7 | Verify Worker is live at its URL |
| 8 | Access admin panel at `/admin` |
| 9 | Add a Provider |
| 10 | Create an API token |
| 11 | Use the API |

### ⚠️ Important Notes

1. **Don't forget your password** — if you lose it, you'll need to delete and recreate the Worker
2. **Copy your token** — the API token is only shown once
3. **Save your Database ID** — you'll need it for troubleshooting
4. **Always check Encrypt** — make sure the Encrypt box is checked for all Secrets
5. **Re-deploy after changes** — after modifying Settings, re-deploy the Worker

---

## 📖 API Reference

### Base URL

```
https://cfrouter.<your-subdomain>.workers.dev
```

### Authentication

Include your gateway API key in whichever header your client uses. All three are accepted:

| Header | Used by |
|---|---|
| `Authorization: Bearer YOUR_API_KEY` | OpenAI SDKs, Cline, Continue, most tools |
| `x-api-key: YOUR_API_KEY` | Anthropic SDKs, Claude Code |
| `x-goog-api-key` / `?key=` | Gemini SDKs |

The key must be a gateway token created under **Tokens** in the dashboard (starts with `sk-`) — not a provider key.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/models` | token | List all available models (`slug/model` IDs) |
| `POST` | `/v1/chat/completions` | token | Chat completion (OpenAI format, incl. streaming) |
| `POST` | `/v1/messages` | token | Anthropic Messages API (incl. streaming + tools) |
| `POST` | `/v1/messages/count_tokens` | token | Token count, answered locally |
| `POST` | `/v1beta/models/{model}:generateContent` | token | Gemini format |
| `POST` | `/v1beta/models/{model}:streamGenerateContent` | token | Gemini format, streaming |
| `GET` | `/v1/health` | none | Public health check (no token required) |
| `GET` | `/` · `/v1` | none | Gateway info (endpoints, time) |
| `GET` | `/docs` | none | Interactive API documentation |
| `GET` | `/admin` | password | Admin dashboard |
| *any* | *any other path* | token | Passed through to the routed provider (e.g. `/v1/embeddings`) |

All three API dialects are translated to the OpenAI format and routed to whichever
provider you name, so one gateway serves every client you use. Paths not listed
above (e.g. `/v1/embeddings`) are forwarded to the selected provider unchanged —
`/v1/chat/completions` is only forced for the dedicated failover helper.

### Model ID Format

Models are addressed as `provider-slug/model-name`:

```
openai/gpt-4o
anthropic/claude-sonnet-4-20250514
my-proxy/llama-3-8b
```

The slug is the provider's **slug** as set in the dashboard (defaults to the
provider name, lowercased and hyphenated). Everything after the first slash is
passed to that provider unchanged, so upstream IDs that contain slashes work too:

```
openrouter/meta-llama/llama-3.1-70b-instruct
```

Behavior notes:

- A `slug/model` whose slug matches no provider returns `404` listing the slugs
  that do exist — unless a provider genuinely advertises that exact slash-name.
- A bare model name (no slash) is **broadcast to every enabled provider** in
  round-robin order; the first success wins. Prefer `slug/model` for predictable routing.

### Tool calling

Tool use works on all three dialects, in both streaming and non-streaming mode.
This is what makes the gateway usable by coding agents — Claude Code and Cline
drive every file edit and shell command through tool calls.

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

### Example: Chat Completion

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### Example: Streaming

```bash
curl -N -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "stream": true,
    "messages": [{"role": "user", "content": "Count to five."}]
  }'
```

### Error semantics

Errors keep the dialect of the request, so SDK retries behave correctly:

| Situation | Status | Body dialect |
|---|---|---|
| Bad gateway key | `401` | OpenAI-style (all paths) |
| Unknown provider slug | `404` | dialect of the request + list of valid slugs |
| Bad request for every provider (`400/404/422`) | passed through | upstream error, unchanged |
| Provider rejected (`401/403/429/5xx`) on **all** targets | `400/404/429` passed through, else `502` | dialect of the request, with `upstream_status` |
| No enabled provider at all | `503` | dialect of the request |

Upstream timeout is 120s per target.

---

## 🤖 Connect a Coding Agent

Point your agent at the gateway instead of at the provider. You need three
things, all from the dashboard:

1. **Base URL** — `https://cfrouter.<your-subdomain>.workers.dev/v1`
2. **API key** — create one under **Tokens** (starts with `sk-`)
3. **Model** — `slug/model`, e.g. `openai/gpt-4o`

Every request is routed to the provider you named. If a provider is down or its
key is rejected, the gateway retries your request against another enabled
provider before giving up.

### Claude Code

Claude Code speaks the Anthropic Messages API, which the gateway serves natively
at `/v1/messages` — tool use included. Set these environment variables:

```bash
export ANTHROPIC_BASE_URL="https://cfrouter.your-subdomain.workers.dev"
export ANTHROPIC_API_KEY="sk-your-gateway-token"
export ANTHROPIC_MODEL="anthropic/claude-sonnet-4-20250514"
```

`ANTHROPIC_BASE_URL` takes no `/v1` suffix — Claude Code appends `/v1/messages`
itself. Then run `claude` in your project as usual. Ask it to read a file: if the
reply comes back with the file's contents, tool calling is working end to end.

> Prefer `ANTHROPIC_API_KEY` over `ANTHROPIC_AUTH_TOKEN`. The former sends the key
> in the `x-api-key` header, the latter in `Authorization: Bearer` — the gateway
> accepts both, but `x-api-key` is the header Claude Code expects to use.

### Cline

In the Cline settings panel:

| Field | Value |
|---|---|
| **API Provider** | OpenAI Compatible |
| **Base URL** | `https://cfrouter.your-subdomain.workers.dev/v1` |
| **API Key** | your `sk-...` gateway token |
| **Model ID** | `slug/model`, e.g. `openai/gpt-4o` |

Cline reads `GET /v1/models` to populate its model dropdown. Every model from
every enabled provider is listed there as `slug/model`, so you can pick one from
the list or type it by hand. If a model you need is missing, open
**Models** in the dashboard and unhide it.

### Continue

In `~/.continue/config.json`, add an entry under `models`:

```json
{
  "title": "CFRouter",
  "provider": "openai",
  "model": "openai/gpt-4o",
  "apiBase": "https://cfrouter.your-subdomain.workers.dev/v1",
  "apiKey": "sk-your-gateway-token"
}
```

### Cursor / OpenAI SDK

Any client that takes an OpenAI base URL works — set the base URL to
`https://cfrouter.<your-subdomain>.workers.dev/v1`, the API key to your gateway
token, and the model to `slug/model`.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://cfrouter.<your-subdomain>.workers.dev/v1",
    api_key="sk-your-gateway-token",
)
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

### Chatbots, automation & more (n8n, Hermes, …)

Anything that speaks the OpenAI protocol works the same way — no extra infrastructure:

- **n8n** — in an OpenAI node (or an HTTP Request node), set the base URL to
  `https://cfrouter.<your-subdomain>.workers.dev/v1` (or your
  [custom domain](#custom-domain-optional)), the credential to your `sk-` gateway token, and
  the model to `slug/model`.
- **Chatbots & Hermes-style agents** — wherever the tool asks for an OpenAI base URL, API key
  and model, paste the same three values. Streaming and tool calling behave like OpenAI, so
  assistants keep working unchanged.
- One gateway serves coding agents, chatbots and automations at once — each with its own token,
  all metered in the same dashboard.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 Invalid API key` | Key missing, or not a gateway token | Use a **gateway** token from **Tokens** (starts with `sk-`), not a provider key |
| `404 Unknown provider slug` | The slug doesn't match any provider | The error lists the valid slugs — check the **Providers** tab |
| Agent hangs, no output | Streaming response can't complete | Confirm the provider's Base URL and token — use **Playground** to test the provider directly |
| Empty model dropdown | Provider's `/models` unreachable from the Worker | Models fall back to the cached **Fetch Models** list; re-run it in the Providers tab |
| `503 No providers available` | No enabled provider | Enable one in the **Providers** tab |

---

## 🔧 Configuration

### Environment Variables (Secrets)

| Secret | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | yes (or `/setup`) | Password for the admin dashboard (min. 6 chars) |
| `SESSION_SECRET` | yes (or `/setup`) | Session signing key (min. 16 chars, random hex recommended) |

Set with `wrangler secret put ADMIN_PASSWORD` and `wrangler secret put SESSION_SECRET`,
or skip both and visit `/setup` on first run — the wizard stores them for you.

### wrangler.toml Settings

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

### Key strategies (per provider)

Each provider picks one strategy for rotating its API keys:

| Strategy | Behavior |
|---|---|
| `round-robin` (default) | Keys used in turn — spreads load evenly |
| `random` | Uniform random pick per request |
| `least-used` | Key with the lowest call count (tracked in D1) |
| `sequential` | Always the first enabled key — predictable, good for primary/backup setups |

Change it in the provider's detail page; it applies to OpenAI, Anthropic, and
Gemini requests alike.

### Companion credentials (per key)

Some providers need a **second value next to the API key**, and that value differs
per key — Cloudflare Workers AI puts the account id in the URL path, Azure OpenAI
puts the resource name in the host and the key in an `api-key` header, Modal wants
two headers. CFRouter stores those as **companion fields on each key**, so one
provider row can round-robin across several accounts instead of one row per account.

Catalog presets declare what they need — selecting one rewrites the hint under the
tokens box to spell out the columns:

| Preset | Companion fields |
|---|---|
| Cloudflare Workers AI | `account_id` → URL path |
| Azure OpenAI | `resource` → host; key sent as `api-key` |
| Snowflake Cortex | `account` → host |
| Modal | `app` → host; key sent as `Modal-Key`, companion secret as `Modal-Secret` |
| OpenAI | `OpenAI-Organization`, `OpenAI-Project` (optional) |

**Bulk entry** — one credential per line, `|`-separated, in the order the provider
declares them (just the key when it declares none):

```
cf-token-1 | 1a2b3c4d5e6f7890
cf-token-2 | 9f8e7d6c5b4a3210
```

A line with the wrong number of columns is rejected with its line number, instead of
silently storing a key with a missing account. The Add/Edit Token modals ask for the
same fields one at a time (secret ones as password inputs).

**Any provider can declare its own** — in the provider's detail page, one field per
line in the credential-fields editor:

```
key | Label | url|query|header | Header-Name | optional,secret
```

`key` is the only required column; the rest default to `url` for the target, the key
itself for the label and wire name, and `required`. Where a field lands:

| Target | Effect |
|---|---|
| `url` | Replaces `{key}` in the provider's Base URL (e.g. `.../accounts/{account_id}/ai/v1`) |
| `query` | Appended to the URL as `?key=value` |
| `header` | Sent as the named header |

The adjacent **auth style** setting controls how the key itself is sent: `bearer`
(default), `x-api-key`, `api-key`, `header:<Name>`, `query:<param>`, `none`.

Keys missing a required companion field are **skipped by the router** — a
half-configured key never gets picked ahead of a good one — and a request that names
that provider answers `400` saying which field is missing.

> **Not supported:** providers that sign each request or exchange the key for a
> short-lived token — AWS Bedrock (SigV4), Vertex AI service-account OAuth, Tencent
> Cloud (TC3), Baidu (legacy OAuth exchange), Snowflake key-pair auth, Azure Entra
> ID. Those need per-request crypto a Worker config can't express here; use a plain
> key wherever the provider offers one.

### Custom Domain (Optional)

Give your gateway your own address — and hand that address to your customers. Cloudflare's own
routing puts your domain in front of the Worker, so clients use it as the base URL exactly like
the default `*.workers.dev` one (TLS is provisioned automatically).

**Via the Cloudflare dashboard (no config file):**

1. Open your Worker's page → **Settings → Domains & Routes → Add → Custom Domain**
2. Enter e.g. `api.yourdomain.com` (the zone must be on Cloudflare)
3. Use `https://api.yourdomain.com/v1` as the base URL everywhere you'd use the `workers.dev` URL

**Via `wrangler.toml` (a route on a zone you own):**

```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

Then `wrangler deploy` — requests to `https://api.yourdomain.com/*` now hit this Worker.

**Serving customers on your domain:** create one gateway token per customer under **Tokens**
(starts with `sk-`), and give each customer the same two things — your domain base URL and their
token. Usage stays separated per token in the analytics tab, so one Worker on your domain serves
all your projects and customers with per-client observability and no extra infrastructure.

### Data model (D1)

The gateway creates its own tables on first request — no migrations to run:

| Table | Purpose |
|---|---|
| `custom_providers` | Providers: name, slug, base URL, keys (+ companion credentials), auth style, strategy, cached models |
| `api_keys` | Gateway tokens (SHA-256 hash + prefix stored, never the raw key) |
| `token_usage` | Per-provider, per-key call counts (drives `least-used`) |
| `usage_summary` | Daily per-token, per-model usage for analytics |
| `api_status` | Provider health state |
| `app_settings` | Admin password hash, setup state |

---

## 🔒 Security Model

- **Gateway tokens** are stored as SHA-256 hashes — the raw token is shown once at
  creation and never again. Only the `sk-` prefix is kept for identification.
- **Provider keys** live in D1 (Cloudflare's edge storage); admin secrets
  (`ADMIN_PASSWORD`, `SESSION_SECRET`) should be set as encrypted Worker secrets.
- **Sessions** are HMAC-signed cookies (24h expiry). Admin HTML responses carry
  `Cache-Control: no-store`.
- **Failover is safe by design:** only idempotent-safe terminal errors fail fast;
  credential/quota/outage errors retry against the next provider.
- **Best practices:** use `least-used` or `round-robin` to avoid hammering one key,
  rotate provider keys periodically, give each client its own gateway token so
  usage analytics stay meaningful, and never commit `wrangler.toml` with a real
  `database_id` to a public fork you don't own (it's harmless but identifies you).

---

## 🏗️ Architecture

Single-file Worker (`src/index.js`, ~6,600 lines) — HTML admin UI, routing, and
dialect translation all live in one deployable unit:

```
cfrouter/
├── src/
│   └── index.js          # The entire gateway (routes, UI, translation)
├── wrangler.toml          # Worker + D1 binding config
├── package.json
├── .github/
│   └── workflows/
│       └── ci.yml         # Validate + deploy pipeline
├── README.md              # English docs (this file)
├── README.fa.md           # Persian docs
├── README.fr.md           # French docs
├── README.ar.md           # Arabic docs
├── README.es.md           # Spanish docs
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## 🛠️ Development

```bash
# Start local dev server
npm run dev

# Deploy to production
npm run deploy

# View live logs
npm run tail
```

### Local D1

```bash
wrangler d1 create cfrouter-db --local
# paste the id into wrangler.toml, then:
npm run dev
```

Admin panel: `http://localhost:8787/admin` · Health: `http://localhost:8787/v1/health`

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating — translation fixes and
new language READMEs are just as valuable as code. Questions before you start?
Write to [info@barivan.com](mailto:info@barivan.com).

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🔗 Related Projects

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Anthropic API](https://docs.anthropic.com/en/api/messages)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) · [Cline](https://github.com/cline/cline) · [Continue](https://github.com/continuedev/continue)

---

## ❓ FAQ

**Is CFRouter free?**
Yes. CFRouter is open source under the MIT license and runs in your own Cloudflare account: you pay
Cloudflare (the free tier is usually enough for a team) plus your own provider bills. There is no
per-request markup, no subscription, and no third-party service sitting in your request path.

**How is it different from LiteLLM, OpenRouter or Portkey?**
CFRouter is a single Cloudflare Worker backed by its own D1 database — nothing to host, no Python
service or container to keep patched, no vendor account between you and your providers. You get an
OpenAI-compatible router inside your own Cloudflare account, with round-robin API key rotation,
automatic failover, a 79-provider catalog and a built-in admin dashboard for usage analytics.

**Can I use it with Claude Code, Cline, Continue, Cursor or VS Code Copilot?**
That is the main use case. Claude Code speaks the native Anthropic Messages API at `/v1/messages`;
every other OpenAI-compatible agent points at `/v1` with a gateway token. Tool calling (function
calling) works on all three dialects, streaming and non-streaming, which is what coding agents need
for every file edit and shell command.

**Does it work with providers other than OpenAI, Anthropic and Gemini?**
Any OpenAI-compatible endpoint works: OpenRouter, Groq, DeepSeek, Together, Fireworks, Cloudflare
Workers AI, Azure OpenAI, Snowflake Cortex, Modal, or a self-hosted Ollama / vLLM server. The
dashboard ships 79 provider presets, and you can add a custom provider with any base URL, header
style and companion credential your provider needs.

**Where do my API keys and traffic live?**
In your Cloudflare account. Provider keys sit in your D1 database, gateway tokens are stored as
SHA-256 hashes (the raw token is shown once), and admin credentials are encrypted Worker secrets.
Requests go from your client straight to your provider through your Worker — no traffic or key
passes through any server we control.

**Can I run it for a team, or for several apps?**
Yes. Create one gateway token per client under **Tokens**, pick a key strategy per provider
(`round-robin`, `random`, `least-used`, `sequential`), and use the analytics tab to see per-key,
per-model token usage — handy for chargeback, for spotting a runaway agent, and for knowing which
provider is actually serving your traffic.

**What happens when a provider goes down or hits a rate limit?**
Requests naming a dead provider are retried transparently against the next enabled one; only terminal
errors (`400`, `404`, `422`) fail fast. A request that names no provider at all broadcasts in
round-robin order and takes the first success.

**Does it support streaming?**
Yes — full SSE streaming on the OpenAI, Anthropic and Gemini dialects, with responses translated
between formats on the fly, including streamed tool calls.

**Can I use it with chatbots, n8n or Hermes-style agents?**
Yes — anything that speaks the OpenAI protocol plugs in with the same three values (base URL,
`sk-` token, `slug/model`). One gateway serves coding agents, chatbots and automations at once,
each on its own token, with no server infrastructure.

**Can I serve my own domain (and my customers) from it?**
Yes. Put your domain in front of the Worker with Cloudflare routing, then hand customers your
domain base URL plus one gateway token each (see [Custom Domain](#custom-domain-optional)).
Usage stays separated per token, so a single Worker on your domain serves every project and
customer.

---

## 📬 Contact

Questions, bug reports, translation fixes, commercial support and security disclosures all reach a
human at the same address:

- **Email:** [info@barivan.com](mailto:info@barivan.com)
- **Issues & feature requests:** [github.com/barivanlab/cfrouter/issues](https://github.com/barivanlab/cfrouter/issues)
- **Discussions & usage questions:** [github.com/barivanlab/cfrouter/discussions](https://github.com/barivanlab/cfrouter/discussions)
- **Security reports:** private advisory only — see [SECURITY.md](SECURITY.md), never a public issue
