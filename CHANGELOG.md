# Changelog

All notable changes to CFRouter are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
