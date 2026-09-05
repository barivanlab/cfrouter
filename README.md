# CFRouter — OpenAI-Compatible AI Gateway & Load Balancer for Cloudflare Workers

> **Route, proxy, and manage multiple AI providers through a single OpenAI-compatible endpoint — deployed on Cloudflare's edge network in minutes.**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivan/cfrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120.svg)](https://workers.cloudflare.com)

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
| **Model Aliases** | Map short names (e.g. `gpt-4o`) to full model IDs (`openai/gpt-4o`) |
| **Admin Dashboard** | Built-in web UI for managing providers, API keys, aliases, and analytics |
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

Use **model aliases** to create short names like `gpt-4o` that map to full model IDs.

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
│  │  Alias Resolver    │   │
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

`cloudflare workers` `ai gateway` `openai compatible` `api proxy` `load balancer` `llm proxy` `ai router` `cloudflare d1` `ai agent` `vscode copilot` `cline` `model alias` `round robin` `ai api` `chat completions` `llm load balancing` `multi provider` `edge computing` `serverless ai` `api management`
