# Changelog

All notable changes to CFRouter are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

Per-key companion credentials.

### Documentation

- Contact address (`info@barivan.com`) added to all five READMEs, `SECURITY.md`, `CONTRIBUTING.md`
  and the docs site footer.
- New "Documentation in Other Languages" section introduces the five translated READMEs; the
  translated files gained matching language badges and a canonical-English note.
- SEO terms are now written into the prose of every README (intro, use cases, FAQ) instead of a
  keyword list at the end; each README gained an FAQ section and a Contact section.
- New `## Translations` section in `CONTRIBUTING.md` covering translation fixes and new languages.
- Install docs now open with a three-path overview (one-click Deploy button, CLI quick start,
  dashboard without CLI) across all five READMEs and the docs site, each path expanding to its
  own steps; the one-click panel is new on the docs site.
- Custom-domain docs rewritten as customer-serving docs: Cloudflare routing (dashboard custom
  domain or `wrangler.toml` route), then one gateway token per customer, per-token analytics.
- New "one gateway, zero servers" benefits (no server bills, one router for all projects,
  centralized key management, multi-token round-robin for more quota) and agent/automation
  coverage (coding agents, chatbots, Hermes-style assistants, n8n) plus matching FAQ entries in
  every README and on the docs site.

### Added
- **Companion credentials per key.** Providers that need a second value alongside
  the API key — Cloudflare Workers AI `account_id`, Azure OpenAI resource, Snowflake
  account, Modal app + secret headers, OpenAI org/project — now store it on each key
  (`{ value, enabled, name, extras: { account_id: "…" } }`), so one provider row can
  round-robin across several accounts instead of one row per account. New
  `credential_fields` and `auth_style` columns on `custom_providers`, created and
  migrated automatically on first request.
- `auth_style` per provider: `bearer` (default), `x-api-key`, `api-key`,
  `header:<Name>`, `query:<param>`, `none`.
- Credential-field targets — `url` (fills a `{placeholder}` in the Base URL),
  `query`, `header` — and an editor on the provider detail page so **any** custom
  provider can declare its own, one per line:
  `key | Label | url|query|header | Header-Name | optional,secret`.
- Bulk token entry accepts `token | account_id | …` lines, columns in the provider's
  declared order; selecting a catalog preset rewrites the hint under the tokens box.
  A line with the wrong column count is rejected with its line number rather than
  storing a key with a missing account.
- Token rows show their companion values, and the Add/Edit Token modals render one
  input per declared field (password-type when the field is marked `secret`).
- `providerUnusableReason` / `credentialFailureResponse` — a request naming a
  provider whose keys cannot complete a call answers `400` naming the missing field,
  in the caller's dialect, instead of an opaque failure.

### Fixed
- **Renaming a provider no longer deletes its API keys.** The Edit Provider modal
  has no `tokens` field, and the handler rebuilt `tokens` from that absent field —
  writing `tokens = '[]'` and silently wiping every key on a rename.
- **Gateway keys no longer leak upstream.** The caller's `Authorization` /
  `x-api-key` / `x-goog-api-key` (a cfrouter `sk-…` key) was copied onto the provider
  request; inbound auth headers are now stripped before the provider's own are set —
  which is also what makes `auth_style: 'api-key'` send one header instead of two.
- Keys missing a required companion field are skipped by the token selector instead
  of building a request against a literal `{placeholder}` host.

## [2.0.0] — 2026-10-18

Public open-source release.

### Added
- Full trilingual documentation set (EN/FA) plus French, Arabic, and Spanish editions
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, issue templates
- `CHANGELOG.md` covering the v1.x line below
- `FUNDING.yml` for sponsor links

### Changed
- Repository links migrated to `barivanlab/cfrouter`
- README rewritten: accurate endpoint table, key strategies, security model, data model

## [1.3] — 2026-10-18

Hardening + robustness release (~1,270 lines).

### Added
- `POST /v1/messages/count_tokens` — token counting answered locally (Claude Code calls it before a turn)
- `extractApiKey` — unified key extraction across `Authorization`, `x-api-key`, `x-goog-api-key`
- `unknownModelResponse` / `advertisesModel` — unknown slugs return `404` with the valid slug list instead of an opaque upstream error
- `upstreamFailureResponse` — dialect-aware error bodies with `upstream_status`
- Local token estimation (`estimateTokens`) for count-tokens
- SSE framing helpers (`createSSELineReader`, `stripFramingHeaders`, `safeParseJson`)

### Fixed
- Slash-containing upstream model IDs (e.g. `meta-llama/Llama-3`) no longer misrouted to the slug guard
- Streaming Anthropic↔OpenAI conversion (`openAIStreamToAnthropic`) hardened

## [1.2] — 2026-10-18

Dashboard release (~1,900 lines).

### Added
- **Models tab** (`renderAdminModels`, `handleModelToggle`, `handleModelBulk`) — per-model and bulk visibility curation; hidden models stay callable
- **Playground tab** (`renderAdminPlayground`, `handlePlayground`) — streaming chat with system prompt, temperature, `max_tokens`, `top_p`
- Token strategy plumbing (`selectToken`, `trackTokenUsage`, `handleSetTokenSelection`) — round-robin, random, least-used, sequential
- Docs tab (`renderAdminDocs`), setup wizard (`setupHtml`, `isSetupComplete`)

## [1.1] — 2026-09-07

Protocol release (~1,400 lines).

### Added
- Native Anthropic Messages translation (both directions, streaming + tools)
- Native Gemini translation (`generateContent` / `streamGenerateContent`)
- Session auth (`createSessionToken`, `validateSessionToken`, `getSetting`)
- Model test actions (`handleTestModel`) and catalog filtering UI

## [1.0] — 2026-09-05

Initial release (~3,300 lines).

### Added
- Single-file Cloudflare Worker: OpenAI-compatible proxy with multi-provider routing
- Admin dashboard (analytics, health, providers, tokens)
- 79-provider quick-setup catalog
- D1-backed usage analytics, API key management, CORS, streaming
