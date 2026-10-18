# Security Policy

## Supported Versions

CFRouter is a single-file Worker; always deploy from the latest `main`.
Only the latest release receives security fixes.

| Version | Supported |
|---------|-----------|
| latest `main` | ✅ |
| older tags / forks pinned to a commit | ❌ |

## Reporting a Vulnerability

**Do not open a public issue for security reports.** Instead:

1. Open a [private security advisory](https://github.com/barivanlab/cfrouter/security/advisories/new)
   (GitHub → Security → Advisories → New draft advisory), or
2. Open an issue with no details and ask for a contact channel.

Please include:

- What you think is vulnerable (endpoint, admin page, auth flow…)
- Steps to reproduce (a `curl` is ideal)
- What you expected vs. what happened
- Your deployment setup (Workers + D1, `wrangler dev`, custom domain…)

We aim to acknowledge reports within **72 hours** and to ship or document a fix
within **14 days** for confirmed issues. We will credit reporters in the release
notes unless you ask to stay anonymous.

## Scope Notes

CFRouter proxies your provider API keys — the most security-sensitive thing in
the deployment. Please:

- Set `ADMIN_PASSWORD` / `SESSION_SECRET` as **encrypted** Worker secrets
  (or via the `/setup` wizard), never in plaintext `wrangler.toml [vars]`.
- Give each client its own gateway token (`/admin` → Tokens) and rotate
  provider keys periodically.
- Treat `wrangler.toml`'s `database_id` as identifying metadata — fine in your
  own repo, but don't paste it into other people's public issues.

Out of scope: vulnerabilities in upstream providers (OpenAI, Anthropic, …),
in Cloudflare's platform, or in a deployment whose secrets were committed
to a public repo.
