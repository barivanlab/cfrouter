# Contributing to CFRouter

Thank you for your interest in contributing to CFRouter! This document provides guidelines and instructions for contributing.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.
For vulnerabilities, see [SECURITY.md](SECURITY.md) — do not open public issues.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/barivanlab/cfrouter.git
cd cfrouter

# Install dependencies
npm install

# Start local development server
npm run dev
```

The dev server will start at `http://localhost:8787`. The admin panel is at `http://localhost:8787/admin`.

### Local Development with D1

For local development with the D1 database:

```bash
# Create a local D1 database (first time only)
wrangler d1 create cfrouter-db --local

# Update the database_id in wrangler.toml with the local binding
# Then run the dev server
npm run dev
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes in `src/index.js`
4. Test locally with `npm run dev` — chat + streaming against at least one provider
5. Add a `CHANGELOG.md` entry under Unreleased
6. Commit your changes with a descriptive message
7. Push to your fork and open a Pull Request (the PR template will guide you)

## Code Style

- Single-file architecture — keep everything in `src/index.js`
- Use descriptive function names
- Add comments for complex logic (routing, dialect translation, failover)
- Follow existing patterns for HTML templates (template literals)
- Errors must keep the request's dialect (OpenAI / Anthropic / Gemini) — see `upstreamFailureResponse`

## Reporting Issues

- Use the bug report template (it asks for repro `curl`, commit, and environment)
- Include steps to reproduce
- Include your Wrangler version (`wrangler --version`)
- Include any error messages
- For usage questions, use [Discussions](https://github.com/barivanlab/cfrouter/discussions)

## Pull Request Process

1. Update the README if your change affects usage (EN at minimum)
2. Ensure your code works with `npm run dev`
3. Keep PRs focused on a single change
4. Write a clear PR description
5. Never commit secrets: `database_id`, tokens, passwords, `.dev.vars`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
