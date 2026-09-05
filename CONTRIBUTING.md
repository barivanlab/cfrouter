# Contributing to CFRouter

Thank you for your interest in contributing to CFRouter! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/barivan/cfrouter.git
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
4. Test locally with `npm run dev`
5. Commit your changes with a descriptive message
6. Push to your fork and open a Pull Request

## Code Style

- Single-file architecture — keep everything in `src/index.js`
- Use descriptive function names
- Add comments for complex logic
- Follow existing patterns for HTML templates (template literals)

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include your Wrangler version (`wrangler --version`)
- Include any error messages

## Pull Request Process

1. Update the README if your change affects usage
2. Ensure your code works with `npm run dev`
3. Keep PRs focused on a single change
4. Write a clear PR description

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
