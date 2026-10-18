# CFRouter — OpenAI-Compatible AI Gateway & Load Balancer for Cloudflare Workers

> **Route, proxy, and manage multiple AI providers through a single OpenAI-compatible endpoint — deployed on Cloudflare's edge network in minutes.**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivan/cfrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120.svg)](https://workers.cloudflare.com)

---

## 📑 Table of Contents

| Section | Description |
|---------|-------------|
| [What is CFRouter?](#what-is-cfrouter) | Overview of the project |
| [Quick Start (CLI)](#-quick-start) | For developers comfortable with the terminal |
| [Install via Cloudflare Dashboard](#️-install-via-cloudflare-dashboard-no-cli-required) | Deploy using only the web interface |
| [Features](#-features) | Full feature list |
| [API Reference](#-api-reference) | Endpoint documentation |
| [Configuration](#-configuration) | Advanced settings |
| [Development](#️-development) | Local development guide |

---

## What is CFRouter?

CFRouter is a **self-hosted AI API gateway** built as a single Cloudflare Worker. It acts as a **reverse proxy** and **load balancer** for LLM providers like OpenAI, Anthropic, Google Gemini, and any OpenAI-compatible API — giving you one unified endpoint for all your AI workloads.

If you're building with **AI agents** (VSCode Copilot, Cline, Continue, Cursor), running **LLM-powered apps**, or managing **multiple API keys** across providers, CFRouter gives you a clean, observable, and cost-effective routing layer on Cloudflare's global edge network.

---

## ✨ Features

| Feature | Description |
|---|---|
| **OpenAI-Compatible API** | Drop-in replacement for OpenAI's API — works with any client that speaks the `/v1/chat/completions` protocol |
| **Multi-Provider Load Balancing** | Round-robin routing across multiple AI providers and API keys |
| **Admin Dashboard** | Built-in web UI for managing providers, API keys, and analytics |
| **Playground** | Chat with any model from an enabled provider straight from the dashboard — streaming, system prompt, temperature, `max_tokens`, `top_p` |
| **Model Curation** | Hide models you don't need from the public `/models` list, per model or in bulk. Hidden models stay callable by ID, so existing callers never break |
| **Usage Tracking** | Per-key, per-model token usage analytics in Cloudflare D1 |
| **Streaming Support** | Full SSE streaming support with transparent response transformation |
| **Health Monitoring** | Real-time provider health status and endpoint availability |
| **Auto-Unblock** | Temporarily failed endpoints are automatically re-enabled |
| **CORS Enabled** | Ready for browser-based AI applications |
| **Zero-Config Deploy** | Single file, one `wrangler deploy` command |
| **D1 Database** | Persistent storage on Cloudflare's edge — no external database needed |
| **Reasoning Content Stripping** | Automatically removes `reasoning_content` fields for OpenAI-compatible clients |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is fine)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### 1. Clone & Install

```bash
git clone https://github.com/barivan/cfrouter.git
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
# Enter a strong password when prompted

wrangler secret put SESSION_SECRET
# Enter a random string (e.g. openssl rand -hex 32)
```

### 4. Deploy

```bash
wrangler deploy
```

Your gateway is live at `https://cfrouter.<your-subdomain>.workers.dev` 🎉

### 5. Configure Your First Provider

1. Open `https://cfrouter.<your-subdomain>.workers.dev/admin`
2. Log in with the password you set
3. Click **+ Add Provider**
4. Enter your provider details (name, base URL, API keys)
5. Click **Fetch Models** to discover available models

---

## 🖥️ Install via Cloudflare Dashboard (No CLI Required)

> This guide is for users who prefer to deploy entirely through the Cloudflare web interface — no terminal or Wrangler CLI needed.

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is fine)
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
> - Go to [github.com/barivan/cfrouter](https://github.com/barivan/cfrouter)
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

> 💡 **Tip:** To generate a random string, use [random.org/string](https://www.random.org/strings/) — generate a 32-character string.

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
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

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

Include your API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/models` | List all available models |
| `POST` | `/v1/chat/completions` | Create a chat completion |
| `POST` | `/v1/embeddings` | Create embeddings |
| `GET` | `/v1/health` | Public health check |
| `GET` | `/docs` | API documentation |
| `GET` | `/admin` | Admin dashboard |

### Example: Chat Completion

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### Model ID Format

Models are addressed using the format `provider-slug/model-name`:

```
openai/gpt-4o
anthropic/claude-3.5-sonnet
my-proxy/llama-3-8b
```

---

## 🔧 Configuration

### Environment Variables (Secrets)

| Secret | Description |
|---|---|
| `ADMIN_PASSWORD` | Password for the admin dashboard |
| `SESSION_SECRET` | Secret key for session signing (use a random hex string) |

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

### Custom Domain (Optional)

To use your own domain instead of `*.workers.dev`:

1. Add a custom domain in the [Cloudflare dashboard](https://dash.cloudflare.com)
2. Update `wrangler.toml`:

```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

---

## 🏗️ Architecture

```
Client (VSCode, Cline, App)
    │
    ▼
┌─────────────────────────┐
│    CFRouter Worker       │  ← Cloudflare Edge
│  ┌───────────────────┐   │
│  │  Load Balancer     │   │
│  │  Usage Tracker     │   │
│  │  Stream Transformer│   │
│  └───────────────────┘   │
│           │               │
│    ┌──────┴──────┐        │
│    ▼     ▼     ▼         │
│  Provider Provider Provider│  ← Round-robin
│    A      B      C        │
└─────────────────────────┘
         │
    Cloudflare D1 (analytics)
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

### Project Structure

```
cfrouter/
├── src/
│   └── index.js          # Single-file Cloudflare Worker
├── wrangler.toml          # Cloudflare Workers config
├── package.json
├── .github/
│   └── workflows/
│       └── ci.yml         # CI/CD pipeline
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🔗 Related Projects

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

---

## Keywords

`cloudflare workers` `ai gateway` `openai compatible` `api proxy` `load balancer` `llm proxy` `ai router` `cloudflare d1` `ai agent` `vscode copilot` `cline` `round robin` `ai api` `chat completions` `llm load balancing` `multi provider` `edge computing` `serverless ai` `api management`
