// ═══════════════════════════════════════════════════════════════════════════
// Barivan AI Gateway - Cloudflare Worker
// Single-file AI load balancer with admin panel, provider management,
// and OpenAI-compatible API for agent integration (VSCode, Cline, etc.)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Configuration ───────────────────────────────────────────────────────
// Set these via `wrangler secret put` or wrangler.toml [vars]
//   wrangler secret put ADMIN_PASSWORD
//   wrangler secret put SESSION_SECRET
// Or use the Setup Wizard at /setup on first run (dashboard users)
const SESSION_MAX_AGE = 86400; // 24 hours in seconds

// ─── Settings Helpers ───────────────────────────────────────────────────
// Read settings from DB (fallback to env vars for CLI users)

async function getSetting(env, key, envKey) {
  // Priority: env var (secret) > DB setting
  if (env[envKey]) return env[envKey];
  try {
    const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first();
    return row?.value || null;
  } catch { return null; }
}

async function isSetupComplete(env) {
  const adminPass = await getSetting(env, 'admin_password', 'ADMIN_PASSWORD');
  const sessionSecret = await getSetting(env, 'session_secret', 'SESSION_SECRET');
  return !!(adminPass && sessionSecret);
}

// ─── Session Helpers ─────────────────────────────────────────────────────

function generateSessionId() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function createSessionToken(env) {
  const sessionId = generateSessionId();
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${sessionId}:${expires}`;
  const encoder = new TextEncoder();
  const sessionSecret = await getSetting(env, 'session_secret', 'SESSION_SECRET');
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
  return `${payload}:${sigHex}`;
}

async function validateSessionToken(token, env) {
  if (!token) return false;
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const [sessionId, expiresStr, sigHex] = parts;
    const expires = parseInt(expiresStr, 10);
    if (Date.now() / 1000 > expires) return false;

    const payload = `${sessionId}:${expiresStr}`;
    const encoder = new TextEncoder();
    const sessionSecret = await getSetting(env, 'session_secret', 'SESSION_SECRET');
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(sessionSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = new Uint8Array(sigHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
  } catch { return false; }
}

function getSessionCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/admin_session=([^;]+)/);
  return match ? match[1] : null;
}

function setSessionCookie(token) {
  return `admin_session=${token}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`;
}

function clearSessionCookie() {
  return `admin_session=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0`;
}

// ─── API Key Helpers ────────────────────────────────────────────────────

function generateApiKey() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return "sk-" + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function hashApiKey(key) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

function maskApiKey(key) {
  if (!key || key.length < 16) return key;
  return key.substring(0, 8) + "..." + key.substring(key.length - 4);
}

// In-memory API key cache with 60s TTL
let _apiKeyCache = null;
let _apiKeyCacheTime = 0;
const API_KEY_CACHE_TTL = 60000;

async function getApiKeyCache(env) {
  const now = Date.now();
  if (_apiKeyCache && (now - _apiKeyCacheTime) < API_KEY_CACHE_TTL) {
    return _apiKeyCache;
  }
  const { results } = await env.DB.prepare("SELECT id, key_hash, key_prefix, enabled FROM api_keys WHERE enabled = 1").all();
  const cache = new Map();
  for (const row of results) {
    cache.set(row.key_hash, { id: row.id, key_prefix: row.key_prefix, enabled: row.enabled });
  }
  _apiKeyCache = cache;
  _apiKeyCacheTime = now;
  return cache;
}

function invalidateApiKeyCache() {
  _apiKeyCache = null;
  _apiKeyCacheTime = 0;
}

async function validateApiKey(env, key) {
  if (!key || !key.startsWith("sk-")) return null;
  const hash = await hashApiKey(key);
  const cache = await getApiKeyCache(env);
  const cached = cache.get(hash);
  if (cached && cached.enabled) {
    return { id: cached.id, key_prefix: cached.key_prefix };
  }
  // Cache miss — check DB directly
  const row = await env.DB.prepare("SELECT id, key_prefix, enabled FROM api_keys WHERE key_hash = ? AND enabled = 1").bind(hash).first();
  if (row) {
    cache.set(hash, { id: row.id, key_prefix: row.key_prefix, enabled: row.enabled });
    return { id: row.id, key_prefix: row.key_prefix };
  }
  return null;
}

// ─── Database Initialization ─────────────────────────────────────────────
// One-time init: only runs on the first request, not every request

let _dbInitialized = false;

async function initDatabase(env) {
  if (_dbInitialized) return;
  _dbInitialized = true;
  try {
    // Single batch: DDL + server list + default aliases — runs ONCE
    const statements = [
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_status (
        url TEXT PRIMARY KEY, is_blocked INTEGER DEFAULT 0, blocked_until TEXT,
        last_used INTEGER DEFAULT 0, disabled INTEGER DEFAULT 0
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS custom_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, base_url TEXT NOT NULL UNIQUE,
        tokens TEXT NOT NULL DEFAULT '[]', enabled INTEGER DEFAULT 1,
        fetched_models TEXT DEFAULT '[]', slug TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        token_selection TEXT DEFAULT 'round-robin'
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS token_usage (
        provider_id INTEGER NOT NULL, token_index INTEGER NOT NULL, calls INTEGER DEFAULT 0,
        PRIMARY KEY (provider_id, token_index)
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS usage_summary (
        token TEXT NOT NULL, date TEXT NOT NULL, endpoints_data TEXT DEFAULT '{}',
        api_key_id INTEGER,
        PRIMARY KEY (token, date)
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS model_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT, alias TEXT NOT NULL UNIQUE, model_id TEXT NOT NULL,
        display_name TEXT DEFAULT '', context_window INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`),
    ];
    await env.DB.batch(statements);

    // Migrations for existing databases (safe to run repeatedly)
    try { await env.DB.prepare("ALTER TABLE custom_providers ADD COLUMN token_selection TEXT DEFAULT 'round-robin'").run(); } catch (e) {}
  } catch (e) { console.error("DB Init Error:", e); }
}

// ─── Midnight UTC Helper ─────────────────────────────────────────────────

function getMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)).toISOString();
}

// ─── Main Fetch Handler ──────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    const corsHeaders = { "Access-Control-Allow-Origin": "*" };

    // Initialize database (one-time, non-blocking)
    ctx.waitUntil(initDatabase(env));

    // ── Setup Wizard (first run) ──
    if (path === "/setup") {
      // If setup already complete, redirect to admin
      if (await isSetupComplete(env)) {
        return new Response(null, { status: 302, headers: { "Location": "/admin/login" } });
      }
      if (request.method === "POST") {
        const body = await request.text();
        const params = new URLSearchParams(body);
        const adminPassword = params.get("admin_password")?.trim();
        const confirmPassword = params.get("confirm_password")?.trim();
        const sessionSecret = params.get("session_secret")?.trim();

        if (!adminPassword || adminPassword.length < 6) {
          return new Response(setupHtml("Password must be at least 6 characters"), {
            headers: { "Content-Type": "text/html; charset=UTF-8" }
          });
        }
        if (adminPassword !== confirmPassword) {
          return new Response(setupHtml("Passwords do not match"), {
            headers: { "Content-Type": "text/html; charset=UTF-8" }
          });
        }
        if (!sessionSecret || sessionSecret.length < 16) {
          return new Response(setupHtml("Session secret must be at least 16 characters"), {
            headers: { "Content-Type": "text/html; charset=UTF-8" }
          });
        }

        // Save to database
        await env.DB.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
          .bind('admin_password', adminPassword).run();
        await env.DB.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
          .bind('session_secret', sessionSecret).run();

        return new Response(null, {
          status: 302,
          headers: { "Location": "/admin/login?setup=1" }
        });
      }
      return new Response(setupHtml(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    // ── Admin Routes ──
    if (path === "/admin/login" || path === "/admin/login/") {
      // If setup not complete, redirect to setup wizard
      if (!(await isSetupComplete(env))) {
        return new Response(null, { status: 302, headers: { "Location": "/setup" } });
      }
      if (request.method === "POST") {
        const body = await request.text();
        const params = new URLSearchParams(body);
        const password = params.get("password");
        const adminPassword = await getSetting(env, 'admin_password', 'ADMIN_PASSWORD');
        if (password === adminPassword) {
          const token = await createSessionToken(env);
          return new Response(null, {
            status: 302,
            headers: {
              "Location": "/admin/analytics",
              "Set-Cookie": setSessionCookie(token)
            }
          });
        }
        return new Response(loginHtml("Invalid password"), {
          headers: { "Content-Type": "text/html; charset=UTF-8" }
        });
      }
      return new Response(loginHtml(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (path === "/admin/logout") {
      return new Response(null, {
        status: 302,
        headers: { "Location": "/admin/login", "Set-Cookie": clearSessionCookie() }
      });
    }

    // Protected admin routes
    if (path.startsWith("/admin")) {
      const sessionToken = getSessionCookie(request);
      const valid = await validateSessionToken(sessionToken, env);
      if (!valid) {
        return new Response(null, {
          status: 302,
          headers: { "Location": "/admin/login" }
        });
      }

      // Admin API actions (POST)
      if (request.method === "POST") {
        if (path === "/admin/providers/add") return await handleAddProvider(request, env);
        if (path === "/admin/providers/edit") return await handleEditProvider(request, env);
        if (path === "/admin/providers/delete") return await handleDeleteProvider(request, env);
        if (path === "/admin/providers/toggle-custom") return await handleToggleCustomProvider(request, env);
        if (path === "/admin/providers/fetch-models") return await handleFetchModels(request, env);
        if (path === "/admin/providers/toggle-token") return await handleToggleToken(request, env);
        if (path === "/admin/providers/edit-token") return await handleEditToken(request, env);
        if (path === "/admin/providers/add-token") return await handleAddToken(request, env);
        if (path === "/admin/providers/delete-token") return await handleDeleteToken(request, env);
        if (path === "/admin/providers/set-token-selection") return await handleSetTokenSelection(request, env);
        if (path === "/admin/providers/test-model") return await handleTestModel(request, env);
        if (path === "/admin/tokens/create") return await handleCreateToken(request, env);
        if (path === "/admin/tokens/toggle") return await handleToggleTokenKey(request, env);
        if (path === "/admin/tokens/delete") return await handleDeleteTokenKey(request, env);
        if (path === "/admin/tokens/rename") return await handleRenameTokenKey(request, env);
      }

      // Admin pages (GET)
      if (path === "/admin" || path === "/admin/") {
        return new Response(null, { status: 302, headers: { "Location": "/admin/analytics" } });
      }
      if (path === "/admin/analytics") return await renderAdminAnalytics(env, url);
      if (path === "/admin/health") return await renderAdminHealth(env);

      // Provider detail page: /admin/providers/:id
      const providerDetailMatch = path.match(/^\/admin\/providers\/(\d+)$/);
      if (providerDetailMatch && request.method === "GET") {
        return await renderProviderDetail(parseInt(providerDetailMatch[1]), env, url);
      }
      if (path === "/admin/providers") return await renderAdminProviders(env);
      if (path === "/admin/tokens") return await renderAdminTokens(env, url);
      if (path === "/admin/docs") return await renderAdminDocs(env);

      return new Response("Not Found", { status: 404 });
    }

    // ── Public API Routes ──
    if (path === "/v1/models" || path === "/models") {
      return await handleModelsEndpoint(env, corsHeaders);
    }

    if (path === "/" || path === "/v1" || path === "/v1/sample") {
      return new Response(JSON.stringify({
        message: "CFRouter Gateway",
        version: "2.0",
        endpoints: {
          models: "/v1/models",
          chat: "/v1/chat/completions",
          docs: "/docs",
          admin: "/admin"
        }
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (path === "/docs" || path === "/v1/docs") {
      return new Response(docsHtml, {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (path === "/v1/health") {
      return await handlePublicHealth(env);
    }

    // ── Anthropic Messages API ──
    if (path === "/v1/messages" && request.method === "POST") {
      return await handleAnthropicRequest(request, url, env, ctx, corsHeaders);
    }

    // ── Gemini API ──
    const geminiMatch = path.match(/^\/v1beta\/models\/(.+):(generateContent|streamGenerateContent)$/);
    if (geminiMatch && request.method === "POST") {
      return await handleGeminiRequest(request, url, env, ctx, corsHeaders, geminiMatch[1], geminiMatch[2] === 'streamGenerateContent');
    }

    // ── API Proxy (Round-Robin) ──
    return await proxyRequest(request, url, path, env, ctx, corsHeaders);
  }
};

// ─── API Proxy ───────────────────────────────────────────────────────────

async function proxyRequest(request, url, path, env, ctx, corsHeaders) {
  // ── Read request body ──
  let requestBuffer = null;
  let bodyText = "";
  if (request.method !== "GET" && request.method !== "HEAD") {
    requestBuffer = await request.arrayBuffer();
    try { bodyText = new TextDecoder().decode(requestBuffer); } catch (e) {}
  }

  const headers = new Headers(request.headers);
  const userToken = headers.get("Authorization")?.replace("Bearer ", "") || "anonymous";
  headers.delete("host");

  // ── API Key Authentication ──
  const apiKey = headers.get("Authorization")?.replace("Bearer ", "");
  const apiKeyData = await validateApiKey(env, apiKey);
  if (!apiKeyData) {
    return new Response(JSON.stringify({
      error: { message: "Invalid or missing API key. Get a key at /admin/tokens", type: "authentication_error", code: "invalid_api_key" }
    }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  // Update last_used_at (non-blocking)
  ctx.waitUntil(
    env.DB.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(apiKeyData.id).run()
  );

  // ── Parse model from body (sync, instant) ──
  let modelName = "unknown";
  let usedAlias = null;
  let isStream = false;
  if (bodyText) {
    try {
      const bodyJson = JSON.parse(bodyText);
      if (bodyJson.model) modelName = bodyJson.model;
      isStream = bodyJson.stream === true;
    } catch (e) {}
  }
  if (!isStream && url.searchParams.get("stream") === "true") isStream = true;

  // ── Auto-unblock expired servers (non-blocking, fire-and-forget) ──
  const nowIso = new Date().toISOString();
  ctx.waitUntil(
    env.DB.prepare("UPDATE api_status SET is_blocked = 0, blocked_until = NULL WHERE is_blocked = 1 AND blocked_until < ?")
      .bind(nowIso).run()
  );

  // ── Resolve alias + fetch custom providers ──
  const aliasQuery = modelName !== "unknown"
    ? env.DB.prepare("SELECT model_id, alias FROM model_aliases WHERE alias = ? AND enabled = 1").bind(modelName).first()
    : Promise.resolve(null);
  const cpQuery = env.DB.prepare(
    "SELECT id, name, base_url, tokens FROM custom_providers WHERE enabled = 1"
  ).all();

  const [aliasRow, { results: customProviders }] = await Promise.all([aliasQuery, cpQuery]);

  if (aliasRow) {
    usedAlias = aliasRow.alias;
    modelName = aliasRow.model_id;
  }

  // ── Build target list ──
  let targets = [];
  let rewrittenModelName = modelName;
  let routedToProvider = false;

  if (modelName !== "unknown" && modelName.includes("/")) {
    const slashIndex = modelName.indexOf("/");
    const slug = modelName.substring(0, slashIndex);
    const actualModel = modelName.substring(slashIndex + 1);

    if (customProviders) {
      for (const cp of customProviders) {
        if ((cp.slug || providerSlug(cp.name)) === slug) {
          const tokens = parseTokens(cp.tokens);
          const selectedToken = await selectToken(tokens, cp.token_selection || 'round-robin', cp.id, env);
          if (selectedToken) {
            targets = [{
              url: cp.base_url.replace(/\/$/, ""),
              type: "custom",
              token: selectedToken.value,
              providerId: cp.id,
              tokenIndex: selectedToken._originalIndex,
            }];
            rewrittenModelName = actualModel;
            routedToProvider = true;
          }
          break;
        }
      }
    }
  }

  // General pool (round-robin) — all enabled custom providers
  if (!routedToProvider && customProviders && customProviders.length > 0) {
    for (const cp of customProviders) {
      const tokens = parseTokens(cp.tokens);
      const selectedToken = await selectToken(tokens, cp.token_selection || 'round-robin', cp.id, env);
      if (selectedToken) {
        targets.push({
          url: cp.base_url.replace(/\/$/, ""),
          type: "custom",
          token: selectedToken.value,
          providerId: cp.id,
          tokenIndex: selectedToken._originalIndex,
        });
      }
    }
  }

  // ── Proxy loop with adaptive timeout per endpoint ──
  let response;
  let success = false;
  let usedProviderId = null;
  let usedTokenIndex = null;
  const needBodyRewrite = (usedAlias || rewrittenModelName !== modelName) && bodyText;
  const upstreamModel = rewrittenModelName;

  for (const target of targets) {
    let targetBaseUrl = target.url;
    if (target.type === "custom") {
      targetBaseUrl = targetBaseUrl.replace(/\/v1\/?$/, "");
    }
    const targetUrl = targetBaseUrl + (path.startsWith("/") ? path : "/" + path) + url.search;

    const proxyHeaders = new Headers(headers);
    if (target.token) {
      proxyHeaders.set("Authorization", `Bearer ${target.token}`);
    }

    let finalBuffer = requestBuffer;
    if (needBodyRewrite) {
      try {
        const bodyJson = JSON.parse(bodyText);
        bodyJson.model = rewrittenModelName;
        const rewrittenText = JSON.stringify(bodyJson);
        finalBuffer = new TextEncoder().encode(rewrittenText);
        proxyHeaders.set("Content-Type", "application/json");
        proxyHeaders.set("Content-Length", String(finalBuffer.byteLength));
      } catch (e) { /* use original buffer */ }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      response = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: finalBuffer,
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timeout);

      // Check for HTML error responses (upstream returned error page instead of JSON)
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html") && response.status === 200) {
        const clonedCheck = response.clone();
        await clonedCheck.text().catch(() => {});
        continue;
      }

      success = true;
      usedProviderId = target.providerId || null;
      usedTokenIndex = target.tokenIndex ?? null;
      break;
    } catch (e) {
      continue;
    }
  }

  if (!success || !response) {
    return new Response(JSON.stringify({
      error: { message: "Service Unavailable", type: "server_error", code: 503 }
    }), {
      status: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  // ── Side effects AFTER proxy succeeds (non-blocking, zero-copy) ──
  const ignoredPaths = ["/", "/v1", "/v1/", "/v1/sample", "/v1/models", "/models", "/docs", "/v1/docs", "/v1/health", "/favicon.ico"];
  const isApiPath = !ignoredPaths.includes(path.toLowerCase());

  if (isApiPath) {
    if (!isStream) {
      // Clone ONCE: background reads clone, client gets original body
      ctx.waitUntil(trackUsage(response.clone(), apiKeyData.id.toString(), path, modelName, env, apiKeyData.id));
    } else {
      ctx.waitUntil(trackStreamUsage(apiKeyData.id.toString(), path, modelName, env, apiKeyData.id));
    }
    // Track provider token usage for least-used strategy
    if (usedProviderId != null && usedTokenIndex != null) {
      ctx.waitUntil(trackTokenUsage(usedProviderId, usedTokenIndex, env));
    }
  }

  // ── Build response with CORS headers ──
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  // ── Normalize response: strip non-standard fields (reasoning_content) ──
  // Qwen3 returns "reasoning_content" which breaks OpenAI-compatible clients
  if (response.status === 200) {
    try {
      if (!isStream) {
        // Non-streaming: parse, transform, re-serialize
        const respText = await response.text();
        if (respText) {
          // Check if response is HTML (upstream error page)
          if (respText.trimStart().startsWith("<!DOCTYPE") || respText.trimStart().startsWith("<html")) {
            return new Response(JSON.stringify({
              error: {
                message: "Upstream returned HTML error page instead of JSON. The model may not support the current prompt length or the endpoint is unavailable.",
                type: "server_error",
                code: 502
              }
            }), {
              status: 502,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          const respJson = JSON.parse(respText);
          if (respJson.choices) {
            for (const choice of respJson.choices) {
              if (choice.message) delete choice.message.reasoning_content;
              if (choice.delta) delete choice.delta.reasoning_content;
            }
          }

          // ── Alias rewriting (non-streaming) ──
          if (usedAlias) {
            if (respJson.model) respJson.model = usedAlias;
            if (respJson.choices) {
              for (const choice of respJson.choices) {
                if (choice.delta?.model) choice.delta.model = usedAlias;
                if (choice.message?.model) choice.message.model = usedAlias;
              }
            }
          }

          return new Response(JSON.stringify(respJson), {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
          });
        }
      } else {
        // Streaming: TransformStream strips reasoning_content from each SSE chunk
        const transform = new TransformStream({
          transform(chunk, controller) {
            try {
              const text = new TextDecoder().decode(chunk);
              const lines = text.split("\n");
              const out = [];
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") {
                    out.push(line);
                    continue;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices) {
                      for (const choice of parsed.choices) {
                        if (choice.delta) delete choice.delta.reasoning_content;
                        if (choice.message) delete choice.message.reasoning_content;
                      }
                    }
                    out.push("data: " + JSON.stringify(parsed));
                  } catch (e) {
                    out.push(line);
                  }
                } else {
                  out.push(line);
                }
              }
              controller.enqueue(new TextEncoder().encode(out.join("\n")));
            } catch (e) {
              controller.enqueue(chunk);
            }
          }
        });

        const transformedResponse = new Response(response.body.pipeThrough(transform), {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
        if (isStream && isApiPath) {
          return captureStreamUsage(transformedResponse, apiKeyData.id.toString(), path, modelName, env, apiKeyData.id);
        }
        return transformedResponse;
      }
    } catch (e) {
      // Fallback: return original response
    }
  }

  // Default: stream body directly (zero buffer)
  if (isStream && isApiPath) {
    return captureStreamUsage(new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    }), apiKeyData.id.toString(), path, modelName, env, apiKeyData.id);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

// ─── Anthropic Messages API Handler ─────────────────────────────────────

async function handleAnthropicRequest(request, url, env, ctx, corsHeaders) {
  // API key auth
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
  const apiKeyData = await validateApiKey(env, apiKey);
  if (!apiKeyData) {
    return new Response(JSON.stringify({
      type: 'error', error: { type: 'authentication_error', message: 'Invalid API key' }
    }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
  ctx.waitUntil(env.DB.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(apiKeyData.id).run());

  // Parse body and convert to OpenAI format
  const body = await request.json();
  const openaiBody = anthropicToOpenAI(body);

  // Resolve model and targets (reuse proxy logic)
  const { targets, rewrittenModel, usedAlias } = await resolveModelAndTargets(env, openaiBody.model);

  if (targets.length === 0) {
    return new Response(JSON.stringify({
      type: 'error', error: { type: 'invalid_request_error', message: 'No providers available' }
    }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  openaiBody.model = rewrittenModel;

  // Fetch upstream
  const { response, success, target: usedTarget } = await fetchUpstream(targets, openaiBody, request.method);

  if (!success) {
    return new Response(JSON.stringify({
      type: 'error', error: { type: 'api_error', message: 'All providers failed' }
    }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  const responseModel = usedAlias || body.model;

  // Handle streaming
  if (body.stream) {
    const transform = openAIStreamToAnthropic(responseModel);
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");
    headers.set("Access-Control-Allow-Origin", "*");
    if (usedTarget?.providerId != null && usedTarget?.tokenIndex != null) {
      ctx.waitUntil(trackTokenUsage(usedTarget.providerId, usedTarget.tokenIndex, env));
    }
    return captureStreamUsage(new Response(response.body.pipeThrough(transform), { status: 200, headers }), apiKeyData.id.toString(), '/v1/messages', responseModel, env, apiKeyData.id);
  }

  // Non-streaming: convert response
  const openaiRes = await response.json();
  const anthropicRes = openAIToAnthropic(openaiRes, responseModel);
  const headers = new Headers({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  ctx.waitUntil(trackUsage(new Response(JSON.stringify(openaiRes)), apiKeyData.id.toString(), '/v1/messages', responseModel, env, apiKeyData.id));
  if (usedTarget?.providerId != null && usedTarget?.tokenIndex != null) {
    ctx.waitUntil(trackTokenUsage(usedTarget.providerId, usedTarget.tokenIndex, env));
  }
  return new Response(JSON.stringify(anthropicRes), { status: 200, headers });
}

// ─── Gemini API Handler ─────────────────────────────────────────────────

async function handleGeminiRequest(request, url, env, ctx, corsHeaders, model, isStream) {
  // API key auth
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
  const apiKeyData = await validateApiKey(env, apiKey);
  if (!apiKeyData) {
    return new Response(JSON.stringify({
      error: { code: 401, message: 'Invalid API key', status: 'UNAUTHENTICATED' }
    }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
  ctx.waitUntil(env.DB.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(apiKeyData.id).run());

  // Parse body and convert to OpenAI format
  const body = await request.json();
  const openaiBody = geminiToOpenAI({ ...body, model });

  // Resolve model and targets
  const { targets, rewrittenModel, usedAlias } = await resolveModelAndTargets(env, openaiBody.model);

  if (targets.length === 0) {
    return new Response(JSON.stringify({
      error: { code: 503, message: 'No providers available', status: 'UNAVAILABLE' }
    }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  openaiBody.model = rewrittenModel;
  openaiBody.stream = isStream;

  // Fetch upstream
  const { response, success, target: usedTarget } = await fetchUpstream(targets, openaiBody, request.method);

  if (!success) {
    return new Response(JSON.stringify({
      error: { code: 503, message: 'All providers failed', status: 'UNAVAILABLE' }
    }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  const responseModel = usedAlias || model;

  // Handle streaming
  if (isStream) {
    const transform = openAIStreamToGemini();
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Access-Control-Allow-Origin", "*");
    if (usedTarget?.providerId != null && usedTarget?.tokenIndex != null) {
      ctx.waitUntil(trackTokenUsage(usedTarget.providerId, usedTarget.tokenIndex, env));
    }
    return captureStreamUsage(new Response(response.body.pipeThrough(transform), { status: 200, headers }), apiKeyData.id.toString(), '/v1beta/models/' + model, responseModel, env, apiKeyData.id);
  }

  // Non-streaming: convert response
  const openaiRes = await response.json();
  const geminiRes = openAIToGemini(openaiRes, responseModel);
  const headers = new Headers({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  ctx.waitUntil(trackUsage(new Response(JSON.stringify(openaiRes)), apiKeyData.id.toString(), '/v1beta/models/' + model, responseModel, env, apiKeyData.id));
  if (usedTarget?.providerId != null && usedTarget?.tokenIndex != null) {
    ctx.waitUntil(trackTokenUsage(usedTarget.providerId, usedTarget.tokenIndex, env));
  }
  return new Response(JSON.stringify(geminiRes), { status: 200, headers });
}

// ─── Shared Proxy Helpers ───────────────────────────────────────────────

async function resolveModelAndTargets(env, modelName) {
  let usedAlias = null;
  let rewrittenModel = modelName;

  // Alias lookup
  if (modelName && modelName !== 'unknown') {
    const aliasRow = await env.DB.prepare(
      "SELECT model_id, alias FROM model_aliases WHERE alias = ? AND enabled = 1"
    ).bind(modelName).first();
    if (aliasRow) {
      usedAlias = aliasRow.alias;
      rewrittenModel = aliasRow.model_id;
    }
  }

  // Fetch custom providers
  const { results: customProviders } = await env.DB.prepare(
    "SELECT id, name, base_url, tokens, slug, token_selection FROM custom_providers WHERE enabled = 1"
  ).all();

  let targets = [];

  // Slug routing
  if (rewrittenModel !== 'unknown' && rewrittenModel.includes("/")) {
    const slashIndex = rewrittenModel.indexOf("/");
    const slug = rewrittenModel.substring(0, slashIndex);
    const actualModel = rewrittenModel.substring(slashIndex + 1);

    for (const cp of customProviders) {
      if ((cp.slug || providerSlug(cp.name)) === slug) {
        const tokens = parseTokens(cp.tokens);
        const selectedToken = await selectToken(tokens, cp.token_selection || 'round-robin', cp.id, env);
        if (selectedToken) {
          targets = [{
            url: cp.base_url.replace(/\/$/, ""),
            token: selectedToken.value,
            providerId: cp.id,
            tokenIndex: selectedToken._originalIndex,
          }];
          rewrittenModel = actualModel;
          break;
        }
      }
    }
  }

  // General pool fallback
  if (targets.length === 0 && customProviders.length > 0) {
    for (const cp of customProviders) {
      const tokens = parseTokens(cp.tokens);
      const selectedToken = await selectToken(tokens, cp.token_selection || 'round-robin', cp.id, env);
      if (selectedToken) {
        targets.push({
          url: cp.base_url.replace(/\/$/, ""),
          token: selectedToken.value,
          providerId: cp.id,
          tokenIndex: selectedToken._originalIndex,
        });
      }
    }
  }

  return { targets, rewrittenModel, usedAlias };
}

async function fetchUpstream(targets, openaiBody, method) {
  for (const target of targets) {
    let targetBaseUrl = target.url.replace(/\/v1\/?$/, "");
    const targetUrl = targetBaseUrl + "/v1/chat/completions";

    const headers = new Headers({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${target.token}`
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(targetUrl, {
        method,
        headers,
        body: JSON.stringify(openaiBody),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        return { response, success: true, target };
      }
    } catch (e) {
      continue;
    }
  }
  return { response: null, success: false, target: null };
}

// ─── Format Conversion Functions ────────────────────────────────────────

// Anthropic Messages API → OpenAI format
function anthropicToOpenAI(body) {
  const messages = [];

  // System message
  if (body.system) {
    const sysText = typeof body.system === 'string' ? body.system
      : Array.isArray(body.system) ? body.system.map(b => b.text || '').join('\n')
      : '';
    if (sysText) messages.push({ role: 'system', content: sysText });
  }

  // Convert messages
  for (const msg of (body.messages || [])) {
    let content = '';
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content.map(b => {
        if (b.type === 'text') return b.text || '';
        if (b.type === 'image') return '[Image]';
        if (b.type === 'tool_use') return `[Tool: ${b.name}]`;
        if (b.type === 'tool_result') return b.content || '';
        return '';
      }).join('\n');
    }
    messages.push({ role: msg.role, content });
  }

  return {
    model: body.model,
    messages,
    max_tokens: body.max_tokens || 4096,
    temperature: body.temperature,
    top_p: body.top_p,
    stream: body.stream || false,
    stop: body.stop_sequences
  };
}

// OpenAI format → Anthropic Messages response
function openAIToAnthropic(openaiRes, model) {
  const choice = openaiRes.choices?.[0];
  const content = [];
  if (choice?.message?.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  return {
    id: openaiRes.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content,
    model: model || openaiRes.model,
    stop_reason: choice?.finish_reason === 'stop' ? 'end_turn' : choice?.finish_reason || 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: openaiRes.usage?.prompt_tokens || 0,
      output_tokens: openaiRes.usage?.completion_tokens || 0
    }
  };
}

// Gemini API → OpenAI format
function geminiToOpenAI(body) {
  const messages = [];

  for (const content of (body.contents || [])) {
    const role = content.role === 'user' ? 'user' : 'assistant';
    let text = '';
    if (Array.isArray(content.parts)) {
      text = content.parts.map(p => p.text || '').join('\n');
    }
    if (text) messages.push({ role, content: text });
  }

  // System instruction
  if (body.systemInstruction?.parts) {
    const sysText = body.systemInstruction.parts.map(p => p.text || '').join('\n');
    if (sysText) messages.unshift({ role: 'system', content: sysText });
  }

  return {
    model: body.model || 'gemini-pro',
    messages,
    max_tokens: body.generationConfig?.maxOutputTokens || 4096,
    temperature: body.generationConfig?.temperature,
    top_p: body.generationConfig?.topP,
    stream: false
  };
}

// OpenAI format → Gemini response
function openAIToGemini(openaiRes, model) {
  const choice = openaiRes.choices?.[0];
  return {
    candidates: [{
      content: {
        parts: [{ text: choice?.message?.content || '' }],
        role: 'model'
      },
      finishReason: choice?.finish_reason === 'stop' ? 'STOP' : choice?.finish_reason || 'STOP'
    }],
    usageMetadata: {
      promptTokenCount: openaiRes.usage?.prompt_tokens || 0,
      candidatesTokenCount: openaiRes.usage?.completion_tokens || 0,
      totalTokenCount: openaiRes.usage?.total_tokens || 0
    },
    modelVersion: model || openaiRes.model
  };
}

// ─── Streaming Format Converters ────────────────────────────────────────

// TransformStream: OpenAI SSE → Anthropic SSE
function openAIStreamToAnthropic(model) {
  let started = false;
  return new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          controller.enqueue(new TextEncoder().encode(
            `event: message_stop\ndata: {"type":"message_stop"}\n\n`
          ));
          continue;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!started) {
            started = true;
            controller.enqueue(new TextEncoder().encode(
              `event: message_start\ndata: {"type":"message_start","message":{"id":"${parsed.id || 'msg_' + Date.now()}","type":"message","role":"assistant","content":[],"model":"${model}","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n`
            ));
          }
          if (delta?.content) {
            controller.enqueue(new TextEncoder().encode(
              `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"${delta.content.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"}}\n\n`
            ));
          }
          if (parsed.choices?.[0]?.finish_reason) {
            controller.enqueue(new TextEncoder().encode(
              `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`
            ));
          }
        } catch (e) {}
      }
    }
  });
}

// TransformStream: OpenAI SSE → Gemini streaming
function openAIStreamToGemini() {
  return new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ done: true }) + '\n'));
          continue;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({
              candidates: [{ content: { parts: [{ text: delta.content }], role: 'model' }, finishReason: 'STOP' }]
            }) + '\n'));
          }
        } catch (e) {}
      }
    }
  });
}

// ─── Usage Tracking (lightweight — no response body cloning) ────────────

async function trackUsage(clonedResponse, token, endpoint, model, env, apiKeyId = null) {
  try {
    let prompt_tokens = 0, completion_tokens = 0, total_tokens = 0;
    try {
      const json = await clonedResponse.json();
      if (json.usage) {
        prompt_tokens = json.usage.prompt_tokens || 0;
        completion_tokens = json.usage.completion_tokens || 0;
        total_tokens = json.usage.total_tokens || 0;
      }
    } catch (e) { prompt_tokens = 1; }

    const date = new Date().toISOString().split('T')[0];
    const existingRow = await env.DB.prepare("SELECT endpoints_data FROM usage_summary WHERE token = ? AND date = ?").bind(token, date).first();
    let data = existingRow?.endpoints_data ? JSON.parse(existingRow.endpoints_data) : {};

    const key = `${endpoint}:${model}`;
    if (!data[key]) data[key] = { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    data[key].calls += 1;
    data[key].prompt_tokens += prompt_tokens;
    data[key].completion_tokens += completion_tokens;
    data[key].total_tokens += total_tokens;

    await env.DB.prepare(`
      INSERT INTO usage_summary (token, date, endpoints_data, api_key_id) VALUES (?, ?, ?, ?)
      ON CONFLICT(token, date) DO UPDATE SET endpoints_data = excluded.endpoints_data, api_key_id = excluded.api_key_id
    `).bind(token, date, JSON.stringify(data), apiKeyId).run();
  } catch (e) { console.error("Usage tracking error:", e); }
}

async function trackStreamUsage(token, endpoint, model, env, apiKeyId = null) {
  try {
    const date = new Date().toISOString().split('T')[0];
    const existingRow = await env.DB.prepare("SELECT endpoints_data FROM usage_summary WHERE token = ? AND date = ?").bind(token, date).first();
    let data = existingRow?.endpoints_data ? JSON.parse(existingRow.endpoints_data) : {};

    const key = `${endpoint}:${model}`;
    if (!data[key]) data[key] = { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    data[key].calls += 1;
    data[key].prompt_tokens += 1;
    data[key].total_tokens += 1;

    await env.DB.prepare(`
      INSERT INTO usage_summary (token, date, endpoints_data, api_key_id) VALUES (?, ?, ?, ?)
      ON CONFLICT(token, date) DO UPDATE SET endpoints_data = excluded.endpoints_data, api_key_id = excluded.api_key_id
    `).bind(token, date, JSON.stringify(data), apiKeyId).run();
  } catch (e) { console.error("Stream usage tracking error:", e); }
}

async function trackTokenUsage(providerId, tokenIndex, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO token_usage (provider_id, token_index, calls) VALUES (?, ?, 1)
      ON CONFLICT(provider_id, token_index) DO UPDATE SET calls = calls + 1
    `).bind(providerId, tokenIndex).run();
  } catch (e) { console.error("Token usage tracking error:", e); }
}

// Wrap a streaming response to capture usage data from SSE chunks
function captureStreamUsage(response, token, endpoint, model, env, apiKeyId) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage = null;

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        // Stream finished — track actual usage if captured
        const date = new Date().toISOString().split('T')[0];
        try {
          const existingRow = await env.DB.prepare("SELECT endpoints_data FROM usage_summary WHERE token = ? AND date = ?").bind(token, date).first();
          let data = existingRow?.endpoints_data ? JSON.parse(existingRow.endpoints_data) : {};
          const key = `${endpoint}:${model}`;
          if (!data[key]) data[key] = { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
          data[key].calls += 1;
          if (usage) {
            data[key].prompt_tokens += usage.prompt_tokens || 0;
            data[key].completion_tokens += usage.completion_tokens || 0;
            data[key].total_tokens += usage.total_tokens || 0;
          } else {
            data[key].prompt_tokens += 1;
            data[key].total_tokens += 1;
          }
          await env.DB.prepare(`
            INSERT INTO usage_summary (token, date, endpoints_data, api_key_id) VALUES (?, ?, ?, ?)
            ON CONFLICT(token, date) DO UPDATE SET endpoints_data = excluded.endpoints_data, api_key_id = excluded.api_key_id
          `).bind(token, date, JSON.stringify(data), apiKeyId).run();
        } catch (e) { console.error("Stream usage track error:", e); }
        controller.close();
        return;
      }
      // Pass chunk through and scan for usage data
      controller.enqueue(value);
      try {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            // OpenAI format: usage in final chunk
            if (obj.usage) {
              usage = {
                prompt_tokens: obj.usage.prompt_tokens || 0,
                completion_tokens: obj.usage.completion_tokens || 0,
                total_tokens: obj.usage.total_tokens || 0
              };
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
  });

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

// ─── Public Health Check ─────────────────────────────────────────────────

async function handlePublicHealth(env) {
  const { results: servers } = await env.DB.prepare("SELECT url, is_blocked, disabled FROM api_status").all();
  const healthy = servers ? servers.filter(s => s.is_blocked === 0 && s.disabled === 0).length : 0;
  const blocked = servers ? servers.filter(s => s.is_blocked === 1).length : 0;
  const disabled = servers ? servers.filter(s => s.disabled === 1).length : 0;

  return new Response(JSON.stringify({
    status: healthy > 0 ? "healthy" : "degraded",
    healthy_endpoints: healthy,
    blocked_endpoints: blocked,
    disabled_endpoints: disabled,
    total_endpoints: servers ? servers.length : 0
  }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

// ─── Provider Management Handlers ────────────────────────────────────────

async function handleAddProvider(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const name = params.get("name")?.trim();
  const slugRaw = params.get("slug")?.trim();
  const baseUrl = params.get("base_url")?.trim();
  const tokensRaw = params.get("tokens")?.trim();

  if (!name || !baseUrl || !tokensRaw) {
    return new Response("Missing required fields", { status: 400 });
  }

  const slug = slugRaw || providerSlug(name);
  const tokens = tokensRaw.split("\n").map(t => t.trim()).filter(t => t.length > 0).map(t => ({ value: t, enabled: true, name: "" }));

  let providerId = null;
  try {
    const result = await env.DB.prepare(
      "INSERT INTO custom_providers (name, slug, base_url, tokens, enabled) VALUES (?, ?, ?, ?, 1)"
    ).bind(name, slug, baseUrl, JSON.stringify(tokens)).run();
    providerId = result.meta?.last_row_id;
  } catch (e) {
    if (e.message?.includes("UNIQUE")) {
      return new Response("A provider with this URL already exists", { status: 409 });
    }
    throw e;
  }

  // Auto-fetch models for the new provider (non-blocking)
  if (providerId) {
    try {
      let modelsUrl = baseUrl.replace(/\/$/, "");
      if (!modelsUrl.endsWith("/v1/models")) {
        modelsUrl = modelsUrl.replace(/\/v1\/?$/, "") + "/v1/models";
      }
      const firstToken = tokens.find(t => t.enabled);
      const fetchHeaders = { "Content-Type": "application/json" };
      if (firstToken) fetchHeaders["Authorization"] = `Bearer ${firstToken.value}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(modelsUrl, { headers: fetchHeaders, signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        let models = [];
        if (data.data && Array.isArray(data.data)) {
          models = data.data.map(m => ({ id: m.id || m.name || "", name: m.name || m.id || "", context_window: m.context_window || m.context_length || null, capabilities: m.capabilities || {}, created: m.created || null }));
        } else if (Array.isArray(data)) {
          models = data.map(m => typeof m === "string" ? { id: m, name: m, context_window: null, capabilities: {}, created: null } : { id: m.id || m.name || "", name: m.name || m.id || "", context_window: m.context_window || m.context_length || null, capabilities: m.capabilities || {}, created: m.created || null });
        }
        if (models.length > 0) {
          await env.DB.prepare("UPDATE custom_providers SET fetched_models = ? WHERE id = ?")
            .bind(JSON.stringify(models), providerId).run();
        }
      }
    } catch (e) { /* ignore auto-fetch errors */ }
  }

  return new Response(null, { status: 302, headers: { "Location": `/admin/providers/${providerId || ""}?added=1` } });
}

async function handleEditProvider(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = params.get("id");
  const name = params.get("name")?.trim();
  const slugRaw = params.get("slug")?.trim();
  const baseUrl = params.get("base_url")?.trim();
  const tokensRaw = params.get("tokens")?.trim();

  if (!id || !name || !baseUrl) {
    return new Response("Missing required fields", { status: 400 });
  }

  const slug = slugRaw || providerSlug(name);
  const tokens = tokensRaw ? tokensRaw.split("\n").map(t => t.trim()).filter(t => t.length > 0).map(t => ({ value: t, enabled: true, name: "" })) : [];

  try {
    await env.DB.prepare(
      "UPDATE custom_providers SET name = ?, slug = ?, base_url = ?, tokens = ? WHERE id = ?"
    ).bind(name, slug, baseUrl, JSON.stringify(tokens), parseInt(id)).run();
  } catch (e) {
    if (e.message?.includes("UNIQUE")) {
      return new Response("A provider with this URL already exists", { status: 409 });
    }
    throw e;
  }

  return new Response(null, { status: 302, headers: { "Location": "/admin/providers?edited=1" } });
}

async function handleDeleteProvider(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = params.get("id");
  if (!id) return new Response("Missing ID", { status: 400 });

  await env.DB.prepare("DELETE FROM custom_providers WHERE id = ?").bind(parseInt(id)).run();
  return new Response(null, { status: 302, headers: { "Location": "/admin/providers?deleted=1" } });
}

async function handleSetTokenSelection(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const providerId = params.get("provider_id");
  const tokenSelection = params.get("token_selection");

  if (!providerId || !tokenSelection) return new Response("Missing fields", { status: 400 });

  const validStrategies = ['round-robin', 'random', 'least-used', 'sequential'];
  if (!validStrategies.includes(tokenSelection)) return new Response("Invalid strategy", { status: 400 });

  await env.DB.prepare("UPDATE custom_providers SET token_selection = ? WHERE id = ?")
    .bind(tokenSelection, parseInt(providerId)).run();

  return new Response(null, { status: 302, headers: { "Location": `/admin/providers/${providerId}?saved=1` } });
}

async function handleToggleCustomProvider(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = params.get("id");
  if (!id) return new Response("Missing ID", { status: 400 });

  await env.DB.prepare("UPDATE custom_providers SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?")
    .bind(parseInt(id)).run();
  return new Response(null, { status: 302, headers: { "Location": "/admin/providers" } });
}

async function handleFetchModels(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const providerUrl = params.get("url")?.trim();
  const providerType = params.get("type") || "custom";
  const providerId = params.get("id");

  if (!providerUrl) return new Response("Missing URL", { status: 400 });

  try {
    let modelsUrl = providerUrl.replace(/\/$/, "");
    if (!modelsUrl.endsWith("/v1/models")) {
      modelsUrl = modelsUrl.replace(/\/v1\/?$/, "") + "/v1/models";
    }

    // Look up provider token for custom providers
    let authToken = null;
    if (providerType === "custom" && providerId) {
      try {
        const { results } = await env.DB.prepare("SELECT tokens, token_selection FROM custom_providers WHERE id = ?")
          .bind(parseInt(providerId)).all();
        if (results && results[0]) {
          const tokens = parseTokens(results[0].tokens);
          const selectedToken = await selectToken(tokens, results[0].token_selection || 'round-robin', parseInt(providerId), env);
          if (selectedToken) authToken = selectedToken.value;
        }
      } catch (e) { /* continue without token */ }
    }

    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(modelsUrl, {
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return new Response(JSON.stringify({ error: `HTTP ${resp.status}: ${errText.substring(0, 200)}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await resp.json();
    let models = [];
    if (data.data && Array.isArray(data.data)) {
      models = data.data.map(m => m.id || m.name || JSON.stringify(m));
    } else if (Array.isArray(data)) {
      models = data.map(m => m.id || m.name || (typeof m === "string" ? m : JSON.stringify(m)));
    } else if (data.models && Array.isArray(data.models)) {
      models = data.models.map(m => typeof m === "string" ? m : (m.id || m.name || ""));
    }

    // Store models for the provider
    if (providerType === "custom" && providerId) {
      await env.DB.prepare("UPDATE custom_providers SET fetched_models = ? WHERE id = ?")
        .bind(JSON.stringify(models), parseInt(providerId)).run();
    }

    return new Response(JSON.stringify({ models, url: providerUrl }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    const errMsg = e.name === "AbortError" ? "Connection timed out" : e.message;
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleTestModel(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const providerId = parseInt(params.get("provider_id"));
  const modelId = params.get("model_id")?.trim();
  const testPrompt = params.get("prompt")?.trim() || "Say hi in one word.";

  if (!providerId || !modelId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing provider_id or model_id" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { results } = await env.DB.prepare("SELECT base_url, tokens, token_selection FROM custom_providers WHERE id = ?")
      .bind(providerId).all();
    if (!results || !results[0]) {
      return new Response(JSON.stringify({ ok: false, error: "Provider not found" }), {
        status: 404, headers: { "Content-Type": "application/json" }
      });
    }

    const p = results[0];
    const tokens = parseTokens(p.tokens);
    const selectedToken = await selectToken(tokens, p.token_selection || 'round-robin', providerId, env);

    if (!selectedToken) {
      return new Response(JSON.stringify({ ok: false, error: "No enabled tokens" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    let targetUrl = p.base_url.replace(/\/$/, "").replace(/\/v1\/?$/, "") + "/v1/chat/completions";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${selectedToken.value}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: testPrompt }],
        max_tokens: 32,
        temperature: 0.3
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "";
      return new Response(JSON.stringify({ ok: true, reply }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } else {
      const errText = await resp.text().catch(() => "");
      return new Response(JSON.stringify({ ok: false, error: `HTTP ${resp.status}: ${errText.substring(0, 200)}` }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (e) {
    const errMsg = e.name === "AbortError" ? "Timeout (15s)" : e.message;
    return new Response(JSON.stringify({ ok: false, error: errMsg }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleFetchAllModels(env) {
  const results = {};

  // Fetch from custom providers
  const { results: customProviders } = await env.DB.prepare(
    "SELECT id, name, base_url, tokens, token_selection FROM custom_providers WHERE enabled = 1"
  ).all();

  if (customProviders) {
    for (const cp of customProviders) {
      try {
        let modelsUrl = cp.base_url.replace(/\/$/, "");
        if (!modelsUrl.endsWith("/v1/models")) {
          modelsUrl = modelsUrl.replace(/\/v1\/?$/, "") + "/v1/models";
        }

        // Get enabled token for this provider
        const tokens = parseTokens(cp.tokens);
        const selectedToken = await selectToken(tokens, cp.token_selection || 'round-robin', cp.id, env);
        const headers = {};
        if (selectedToken) headers["Authorization"] = `Bearer ${selectedToken.value}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(modelsUrl, { headers, signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const data = await resp.json();
          let models = [];
          if (data.data && Array.isArray(data.data)) {
            models = data.data.map(m => m.id || m.name || "");
          } else if (Array.isArray(data)) {
            models = data.map(m => m.id || m.name || (typeof m === "string" ? m : ""));
          }
          await env.DB.prepare("UPDATE custom_providers SET fetched_models = ? WHERE id = ?")
            .bind(JSON.stringify(models), cp.id).run();
          results[cp.name] = models;
        } else {
          results[cp.name] = { error: `HTTP ${resp.status}` };
        }
      } catch (e) {
        results[cp.name] = { error: e.name === "AbortError" ? "Timeout" : e.message };
      }
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

// ─── Models Endpoint (Public) ────────────────────────────────────────────

async function handleModelsEndpoint(env, corsHeaders) {
  const allModels = [];

  // Custom provider models (prefixed with provider slug)
  try {
    const { results: customProviders } = await env.DB.prepare(
      "SELECT id, name, slug, base_url, tokens, fetched_models, token_selection FROM custom_providers WHERE enabled = 1"
    ).all();

    if (customProviders) {
      for (const cp of customProviders) {
        const slug = cp.slug || providerSlug(cp.name);
        const cachedModels = JSON.parse(cp.fetched_models || "[]");

        // Try to fetch fresh models with full details from the provider
        let liveModels = cachedModels;
        try {
          let modelsUrl = cp.base_url.replace(/\/$/, "");
          if (!modelsUrl.endsWith("/v1/models")) {
            modelsUrl = modelsUrl.replace(/\/v1\/?$/, "") + "/v1/models";
          }
          // Get enabled token for auth
          const tokens = parseTokens(cp.tokens);
          const selectedToken = await selectToken(tokens, cp.token_selection || 'round-robin', cp.id, env);
          const fetchHeaders = {};
          if (selectedToken) fetchHeaders["Authorization"] = `Bearer ${selectedToken.value}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const resp = await fetch(modelsUrl, { headers: fetchHeaders, signal: controller.signal });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const data = await resp.json();
            let fetched = [];
            if (data.data && Array.isArray(data.data)) {
              fetched = data.data.map(m => ({
                id: m.id || m.name || "",
                name: m.name || m.id || "",
                context_window: m.context_window || m.context_length || null,
                capabilities: m.capabilities || {},
                created: m.created || null
              }));
            } else if (Array.isArray(data)) {
              fetched = data.map(m => {
                if (typeof m === "string") return { id: m, name: m, context_window: null, capabilities: {}, created: null };
                return { id: m.id || m.name || "", name: m.name || m.id || "", context_window: m.context_window || m.context_length || null, capabilities: m.capabilities || {}, created: m.created || null };
              });
            }
            if (fetched.length > 0) {
              liveModels = fetched;
              // Update cache with full details
              await env.DB.prepare("UPDATE custom_providers SET fetched_models = ? WHERE id = ?")
                .bind(JSON.stringify(liveModels), cp.id).run();
            }
          }
        } catch (e) {
          // Use cached models on fetch failure
        }

        // Add each model with provider slug prefix
        for (const model of liveModels) {
          if (!model || !model.id) continue;
          const modelId = model.id;
          // Model ID format: {slug}/{model_name} e.g. "bai/glm-5.3-flash"
          const fullId = `${slug}/${modelId}`;
          allModels.push({
            id: fullId,
            object: "model",
            created: model.created || Math.floor(Date.now() / 1000),
            owned_by: cp.name,
            provider_id: `custom_${cp.id}`,
            provider_type: "custom",
            provider_name: cp.name,
            provider_url: cp.base_url,
            provider_slug: slug,
            context_window: model.context_window || null,
            capabilities: model.capabilities || {},
            permission: [],
            root: fullId,
            parent: null
          });
        }
      }
    }
  } catch (e) {
    console.error("Models endpoint error:", e);
  }

  // 3. Model aliases (short names that map to full model IDs)
  try {
    const { results: aliases } = await env.DB.prepare(
      "SELECT alias, model_id, display_name, context_window FROM model_aliases WHERE enabled = 1"
    ).all();
    if (aliases) {
      for (const a of aliases) {
        allModels.push({
          id: a.alias,
          object: "model",
          created: 1700000000,
          owned_by: "cfrouter",
          provider_id: "cf_cluster",
          provider_type: "cloudflare",
          alias_for: a.model_id,
          context_window: a.context_window || null,
          capabilities: {},
          permission: [],
          root: a.alias,
          parent: null
        });
      }
    }
  } catch (e) {
    console.error("Models endpoint alias error:", e);
  }

  return new Response(JSON.stringify({
    object: "list",
    data: allModels
  }), {
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

// ─── Token Management Handlers ──────────────────────────────────────────

async function handleToggleToken(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const providerId = parseInt(params.get("provider_id"));
  const tokenIndex = parseInt(params.get("token_index"));
  if (!providerId || isNaN(tokenIndex)) return new Response("Bad params", { status: 400 });

  const { results } = await env.DB.prepare("SELECT tokens FROM custom_providers WHERE id = ?").bind(providerId).all();
  if (!results || !results.length) return new Response("Provider not found", { status: 404 });

  const tokens = parseTokens(results[0].tokens);
  if (tokenIndex < 0 || tokenIndex >= tokens.length) return new Response("Invalid token index", { status: 400 });

  tokens[tokenIndex].enabled = !tokens[tokenIndex].enabled;
  await env.DB.prepare("UPDATE custom_providers SET tokens = ? WHERE id = ?")
    .bind(tokensToJSON(tokens), providerId).run();

  return new Response(null, { status: 302, headers: { "Location": "/admin/providers" } });
}

async function handleEditToken(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const providerId = parseInt(params.get("provider_id"));
  const tokenIndex = parseInt(params.get("token_index"));
  const tokenValue = params.get("token_value")?.trim();
  const tokenName = params.get("token_name")?.trim() || "";
  if (!providerId || isNaN(tokenIndex) || !tokenValue) return new Response("Bad params", { status: 400 });

  const { results } = await env.DB.prepare("SELECT tokens FROM custom_providers WHERE id = ?").bind(providerId).all();
  if (!results || !results.length) return new Response("Provider not found", { status: 404 });

  const tokens = parseTokens(results[0].tokens);
  if (tokenIndex < 0 || tokenIndex >= tokens.length) return new Response("Invalid token index", { status: 400 });

  tokens[tokenIndex].value = tokenValue;
  tokens[tokenIndex].name = tokenName;
  await env.DB.prepare("UPDATE custom_providers SET tokens = ? WHERE id = ?")
    .bind(tokensToJSON(tokens), providerId).run();

  return new Response(null, { status: 302, headers: { "Location": "/admin/providers" } });
}

async function handleAddToken(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const providerId = parseInt(params.get("provider_id"));
  const tokenValue = params.get("token_value")?.trim();
  const tokenName = params.get("token_name")?.trim() || "";
  if (!providerId || !tokenValue) return new Response("Bad params", { status: 400 });

  const { results } = await env.DB.prepare("SELECT tokens FROM custom_providers WHERE id = ?").bind(providerId).all();
  if (!results || !results.length) return new Response("Provider not found", { status: 404 });

  const tokens = parseTokens(results[0].tokens);
  tokens.push({ value: tokenValue, enabled: true, name: tokenName });
  await env.DB.prepare("UPDATE custom_providers SET tokens = ? WHERE id = ?")
    .bind(tokensToJSON(tokens), providerId).run();

  return new Response(null, { status: 302, headers: { "Location": `/admin/providers/${providerId}` } });
}

async function handleDeleteToken(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const providerId = parseInt(params.get("provider_id"));
  const tokenIndex = parseInt(params.get("token_index"));
  if (!providerId || isNaN(tokenIndex)) return new Response("Bad params", { status: 400 });

  const { results } = await env.DB.prepare("SELECT tokens FROM custom_providers WHERE id = ?").bind(providerId).all();
  if (!results || !results.length) return new Response("Provider not found", { status: 404 });

  const tokens = parseTokens(results[0].tokens);
  if (tokenIndex < 0 || tokenIndex >= tokens.length) return new Response("Invalid token index", { status: 400 });

  tokens.splice(tokenIndex, 1);
  await env.DB.prepare("UPDATE custom_providers SET tokens = ? WHERE id = ?")
    .bind(tokensToJSON(tokens), providerId).run();

  return new Response(null, { status: 302, headers: { "Location": "/admin/providers" } });
}

// ─── Model Alias Handlers ──────────────────────────────────────────────

async function handleAddAlias(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const alias = params.get("alias")?.trim().toLowerCase();
  const modelId = params.get("model_id")?.trim();
  const displayName = params.get("display_name")?.trim() || "";
  const contextWindow = parseInt(params.get("context_window") || "0", 10);

  if (!alias || !modelId) {
    return new Response("Missing required fields", { status: 400 });
  }

  try {
    await env.DB.prepare(
      "INSERT INTO model_aliases (alias, model_id, display_name, context_window, enabled) VALUES (?, ?, ?, ?, 1)"
    ).bind(alias, modelId, displayName, contextWindow || 0).run();
  } catch (e) {
    if (e.message?.includes("UNIQUE")) {
      return new Response("An alias with this name already exists", { status: 409 });
    }
    throw e;
  }

  return new Response(null, { status: 302, headers: { "Location": "/admin/aliases?added=1" } });
}

async function handleEditAlias(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = parseInt(params.get("id"));
  const alias = params.get("alias")?.trim().toLowerCase();
  const modelId = params.get("model_id")?.trim();
  const displayName = params.get("display_name")?.trim() || "";
  const contextWindow = parseInt(params.get("context_window") || "0", 10);

  if (!id || !alias || !modelId) {
    return new Response("Missing required fields", { status: 400 });
  }

  try {
    await env.DB.prepare(
      "UPDATE model_aliases SET alias = ?, model_id = ?, display_name = ?, context_window = ? WHERE id = ?"
    ).bind(alias, modelId, displayName, contextWindow || 0, id).run();
  } catch (e) {
    if (e.message?.includes("UNIQUE")) {
      return new Response("An alias with this name already exists", { status: 409 });
    }
    throw e;
  }

  return new Response(null, { status: 302, headers: { "Location": "/admin/aliases?edited=1" } });
}

async function handleDeleteAlias(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = parseInt(params.get("id"));
  if (!id) return new Response("Missing ID", { status: 400 });

  await env.DB.prepare("DELETE FROM model_aliases WHERE id = ?").bind(id).run();
  return new Response(null, { status: 302, headers: { "Location": "/admin/aliases?deleted=1" } });
}

async function handleToggleAlias(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = parseInt(params.get("id"));
  if (!id) return new Response("Missing ID", { status: 400 });

  await env.DB.prepare("UPDATE model_aliases SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?")
    .bind(id).run();
  return new Response(null, { status: 302, headers: { "Location": "/admin/aliases" } });
}

// ─── Token Management Handlers ──────────────────────────────────────────

async function handleCreateToken(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const name = params.get("name")?.trim();
  if (!name) return new Response("Missing name", { status: 400 });

  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12) + "...";

  await env.DB.prepare("INSERT INTO api_keys (name, key_hash, key_prefix) VALUES (?, ?, ?)")
    .bind(name, keyHash, keyPrefix).run();
  invalidateApiKeyCache();

  // Return page showing the key once
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Token Created - CFRouter</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',-apple-system,sans-serif;background:#06080f;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:rgba(15,20,35,0.8);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:36px;max-width:500px;width:90%;text-align:center}
  h2{font-size:20px;font-weight:700;margin-bottom:8px}
  p{color:#94a3b8;font-size:13px;margin-bottom:20px}
  .key-box{background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:16px;margin-bottom:20px;word-break:break-all;font-family:monospace;font-size:13px;color:#10b981}
  .warning{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:12px;margin-bottom:20px;font-size:12px;color:#f59e0b}
  .btn{padding:10px 24px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;display:inline-block}
  .btn:hover{opacity:0.9}
</style>
</head>
<body>
<div class="card">
  <h2>✅ Token Created</h2>
  <p>Your new API token for <strong>${name}</strong></p>
  <div class="key-box" id="key">${rawKey}</div>
  <div class="warning">⚠️ Copy this key now. It will NOT be shown again.</div>
  <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('key').textContent).then(()=>this.textContent='Copied!')">Copy Key</button>
  &nbsp;
  <a href="/admin/tokens" class="btn" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1)">Back to Tokens</a>
</div>
</body>
</html>`, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
}

async function handleToggleTokenKey(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = parseInt(params.get("id"));
  if (!id) return new Response("Missing ID", { status: 400 });

  await env.DB.prepare("UPDATE api_keys SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?")
    .bind(id).run();
  invalidateApiKeyCache();
  return new Response(null, { status: 302, headers: { "Location": "/admin/tokens" } });
}

async function handleDeleteTokenKey(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = parseInt(params.get("id"));
  if (!id) return new Response("Missing ID", { status: 400 });

  await env.DB.prepare("DELETE FROM api_keys WHERE id = ?").bind(id).run();
  invalidateApiKeyCache();
  return new Response(null, { status: 302, headers: { "Location": "/admin/tokens" } });
}

async function handleRenameTokenKey(request, env) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const id = parseInt(params.get("id"));
  const name = params.get("name")?.trim();
  if (!id || !name) return new Response("Missing fields", { status: 400 });

  await env.DB.prepare("UPDATE api_keys SET name = ? WHERE id = ?").bind(name, id).run();
  return new Response(null, { status: 302, headers: { "Location": "/admin/tokens" } });
}

// ─── Setup Wizard Page ──────────────────────────────────────────────────

function setupHtml(errorMsg) {
  // Generate a random 32-char hex string for session secret
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const defaultSecret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Setup - CFRouter</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#06080f;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
  body::before{content:'';position:fixed;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(ellipse at 30% 20%,rgba(56,189,248,0.06) 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,rgba(139,92,246,0.05) 0%,transparent 50%);pointer-events:none;z-index:0}
  .setup-wrap{position:relative;z-index:1;width:100%;max-width:460px;margin:20px}
  .setup-card{background:rgba(15,20,35,0.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:44px 36px;box-shadow:0 25px 60px rgba(0,0,0,0.5)}
  .logo{text-align:center;margin-bottom:32px}
  .logo-icon{width:52px;height:52px;margin:0 auto 16px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 8px 24px rgba(59,130,246,0.3)}
  .logo h1{font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.5px}
  .logo p{font-size:12px;color:#64748b;margin-top:6px;letter-spacing:0.3px}
  .field{margin-bottom:20px}
  .field label{display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
  .field input{width:100%;padding:13px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;color:#f1f5f9;font-size:14px;outline:none;transition:all 0.2s}
  .field input:focus{border-color:rgba(59,130,246,0.5);box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
  .field input::placeholder{color:#475569}
  .field .hint{font-size:11px;color:#475569;margin-top:6px}
  .btn-setup{width:100%;padding:13px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;letter-spacing:0.3px}
  .btn-setup:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(59,130,246,0.3)}
  .btn-setup:active{transform:translateY(0)}
  .error{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:12px 16px;margin-bottom:22px;font-size:13px;color:#fca5a5;display:flex;align-items:center;gap:8px}
  .info{background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:14px 16px;margin-bottom:24px;font-size:12px;color:#93c5fd;line-height:1.6}
  .info strong{color:#60a5fa}
  .footer{text-align:center;margin-top:28px;font-size:11px;color:#334155;letter-spacing:0.3px}
</style>
</head>
<body>
<div class="setup-wrap">
  <div class="setup-card">
    <div class="logo">
      <div class="logo-icon">⚡</div>
      <h1>CFRouter</h1>
      <p>Initial Setup</p>
    </div>
    <div class="info">
      <strong>Welcome!</strong> This appears to be your first time running CFRouter.<br>
      Please set your <strong>Admin Password</strong> and <strong>Session Secret</strong> to continue.
    </div>
    ${errorMsg ? `<div class="error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>${errorMsg}</div>` : ''}
    <form method="POST" action="/setup">
      <div class="field">
        <label>Admin Password</label>
        <input type="password" name="admin_password" autofocus placeholder="Min 6 characters" required minlength="6">
      </div>
      <div class="field">
        <label>Confirm Password</label>
        <input type="password" name="confirm_password" placeholder="Repeat your password" required minlength="6">
      </div>
      <div class="field">
        <label>Session Secret</label>
        <input type="text" name="session_secret" value="${defaultSecret}" required minlength="16">
        <div class="hint">Auto-generated. Used to sign login sessions. You can change it if you want.</div>
      </div>
      <button type="submit" class="btn-setup">Complete Setup</button>
    </form>
    <div class="footer">CFRouter Gateway &middot; v3.0</div>
  </div>
</div>
</body>
</html>`;
}

// ─── Admin Login Page ────────────────────────────────────────────────────

function loginHtml(errorMsg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login - CFRouter</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#06080f;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
  body::before{content:'';position:fixed;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(ellipse at 30% 20%,rgba(56,189,248,0.06) 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,rgba(139,92,246,0.05) 0%,transparent 50%);pointer-events:none;z-index:0}
  .login-wrap{position:relative;z-index:1;width:100%;max-width:400px;margin:20px}
  .login-card{background:rgba(15,20,35,0.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:44px 36px;box-shadow:0 25px 60px rgba(0,0,0,0.5)}
  .logo{text-align:center;margin-bottom:36px}
  .logo-icon{width:52px;height:52px;margin:0 auto 16px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 8px 24px rgba(59,130,246,0.3)}
  .logo h1{font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.5px}
  .logo p{font-size:12px;color:#64748b;margin-top:6px;letter-spacing:0.3px}
  .field{margin-bottom:22px}
  .field label{display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
  .field input{width:100%;padding:13px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;color:#f1f5f9;font-size:14px;outline:none;transition:all 0.2s}
  .field input:focus{border-color:rgba(59,130,246,0.5);box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
  .field input::placeholder{color:#475569}
  .btn-login{width:100%;padding:13px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;letter-spacing:0.3px}
  .btn-login:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(59,130,246,0.3)}
  .btn-login:active{transform:translateY(0)}
  .error{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:12px 16px;margin-bottom:22px;font-size:13px;color:#fca5a5;display:flex;align-items:center;gap:8px}
  .footer{text-align:center;margin-top:28px;font-size:11px;color:#334155;letter-spacing:0.3px}
</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <div class="logo">
      <div class="logo-icon">⚡</div>
      <h1>CFRouter</h1>
      <p>Gateway Control Center</p>
    </div>
    ${errorMsg ? `<div class="error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>${errorMsg}</div>` : ''}
    <form method="POST" action="/admin/login">
      <div class="field">
        <label>Password</label>
        <input type="password" name="password" autofocus placeholder="Enter your password" required>
      </div>
      <button type="submit" class="btn-login">Sign In</button>
    </form>
    <div class="footer">CFRouter Gateway &middot; v3.0</div>
  </div>
</div>
</body>
</html>`;
}

// ─── Admin Dashboard Layout ──────────────────────────────────────────────

function adminLayout(title, activeTab, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - CFRouter</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{
    --bg-primary:#06080f;
    --bg-secondary:rgba(15,20,35,0.7);
    --bg-card:rgba(15,20,35,0.6);
    --bg-card-hover:rgba(20,25,45,0.8);
    --bg-input:rgba(255,255,255,0.03);
    --border-subtle:rgba(255,255,255,0.06);
    --border-medium:rgba(255,255,255,0.1);
    --border-active:rgba(59,130,246,0.4);
    --text-primary:#f1f5f9;
    --text-secondary:#94a3b8;
    --text-muted:#475569;
    --accent-blue:#3b82f6;
    --accent-purple:#8b5cf6;
    --accent-green:#10b981;
    --accent-amber:#f59e0b;
    --accent-rose:#f43f5e;
    --accent-cyan:#06b6d4;
    --glass-bg:rgba(15,20,35,0.8);
    --glass-border:rgba(255,255,255,0.06);
    --radius:12px;
    --radius-lg:16px;
    --radius-xl:20px;
    --shadow-card:0 4px 24px rgba(0,0,0,0.3);
    --shadow-glow:0 0 40px rgba(59,130,246,0.08);
    --transition:all 0.2s cubic-bezier(0.4,0,0.2,1);
  }
  body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg-primary);color:var(--text-primary);min-height:100vh;overflow-x:hidden}
  body::before{content:'';position:fixed;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at 20% 0%,rgba(59,130,246,0.04) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(139,92,246,0.03) 0%,transparent 50%);pointer-events:none;z-index:0}

  /* ─── Sidebar ─── */
  .sidebar{position:fixed;top:0;left:0;width:240px;height:100vh;background:var(--glass-bg);backdrop-filter:blur(24px);border-right:1px solid var(--glass-border);display:flex;flex-direction:column;z-index:100;transition:var(--transition)}
  .sidebar-brand{padding:24px 20px;border-bottom:1px solid var(--border-subtle)}
  .brand-row{display:flex;align-items:center;gap:12px}
  .brand-icon{width:38px;height:38px;background:linear-gradient(135deg,var(--accent-blue),var(--accent-purple));border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(59,130,246,0.25);flex-shrink:0}
  .brand-text h1{font-size:15px;font-weight:700;color:var(--text-primary);letter-spacing:-0.3px;line-height:1.2}
  .brand-text p{font-size:10px;color:var(--text-muted);letter-spacing:0.5px;text-transform:uppercase;margin-top:2px}
  .nav-section{flex:1;padding:16px 12px;overflow-y:auto}
  .nav-label{font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;padding:0 12px;margin-bottom:8px}
  .nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:500;color:var(--text-secondary);transition:var(--transition);margin-bottom:2px;border:1px solid transparent}
  .nav-item:hover{background:rgba(255,255,255,0.04);color:var(--text-primary);border-color:var(--border-subtle)}
  .nav-item.active{background:rgba(59,130,246,0.08);color:var(--accent-blue);border-color:rgba(59,130,246,0.2);box-shadow:0 0 20px rgba(59,130,246,0.05)}
  .nav-item svg{width:18px;height:18px;flex-shrink:0;opacity:0.7}
  .nav-item.active svg{opacity:1}
  .sidebar-bottom{padding:16px 12px;border-top:1px solid var(--border-subtle)}
  .nav-item.signout{color:var(--text-muted);font-size:12px}
  .nav-item.signout:hover{color:var(--accent-rose);background:rgba(244,63,94,0.06);border-color:rgba(244,63,94,0.15)}

  /* ─── Main ─── */
  .main{margin-left:240px;padding:32px 36px;min-height:100vh;position:relative;z-index:1}
  .page-header{margin-bottom:32px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .page-header-left h2{font-size:26px;font-weight:800;color:var(--text-primary);letter-spacing:-0.5px;line-height:1.2}
  .page-header-left p{font-size:13px;color:var(--text-muted);margin-top:4px}
  .page-header-actions{display:flex;gap:8px;flex-wrap:wrap}

  /* ─── Stat Cards ─── */
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:28px}
  .stat-card{background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:20px;transition:var(--transition);position:relative;overflow:hidden}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent-blue),transparent);opacity:0;transition:var(--transition)}
  .stat-card:hover{border-color:var(--border-medium);transform:translateY(-1px);box-shadow:var(--shadow-card)}
  .stat-card:hover::before{opacity:1}
  .stat-card .label{font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px}
  .stat-card .value{font-size:32px;font-weight:800;color:var(--text-primary);line-height:1}
  .stat-card .sub{font-size:11px;color:var(--text-muted);margin-top:8px}
  .stat-card.blue .value{color:var(--accent-blue)}
  .stat-card.blue::before{background:linear-gradient(90deg,transparent,var(--accent-blue),transparent)}
  .stat-card.green .value{color:var(--accent-green)}
  .stat-card.green::before{background:linear-gradient(90deg,transparent,var(--accent-green),transparent)}
  .stat-card.amber .value{color:var(--accent-amber)}
  .stat-card.amber::before{background:linear-gradient(90deg,transparent,var(--accent-amber),transparent)}
  .stat-card.rose .value{color:var(--accent-rose)}
  .stat-card.rose::before{background:linear-gradient(90deg,transparent,var(--accent-rose),transparent)}
  .stat-card.purple .value{color:var(--accent-purple)}
  .stat-card.purple::before{background:linear-gradient(90deg,transparent,var(--accent-purple),transparent)}
  .stat-card.cyan .value{color:var(--accent-cyan)}
  .stat-card.cyan::before{background:linear-gradient(90deg,transparent,var(--accent-cyan),transparent)}
  .stat-card.orange .value{color:#f97316}
  .stat-card.orange::before{background:linear-gradient(90deg,transparent,#f97316,transparent)}
  .stat-card.slate .value{color:var(--text-secondary)}
  .stat-card.slate::before{background:linear-gradient(90deg,transparent,var(--text-secondary),transparent)}

  /* ─── Table ─── */
  .table-wrap{background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius);overflow:hidden}
  .table-scroll{overflow-x:auto}
  table{width:100%;border-collapse:collapse}
  thead{background:rgba(255,255,255,0.02);border-bottom:1px solid var(--border-subtle)}
  th{padding:12px 16px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;text-align:left;white-space:nowrap}
  td{padding:12px 16px;font-size:13px;border-bottom:1px solid var(--border-subtle);white-space:nowrap}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:rgba(255,255,255,0.02)}

  /* ─── Badges ─── */
  .badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.2px}
  .badge-green{background:rgba(16,185,129,0.1);color:var(--accent-green);border:1px solid rgba(16,185,129,0.2)}
  .badge-rose{background:rgba(244,63,94,0.1);color:var(--accent-rose);border:1px solid rgba(244,63,94,0.2)}
  .badge-amber{background:rgba(245,158,11,0.1);color:var(--accent-amber);border:1px solid rgba(245,158,11,0.2)}
  .badge-blue{background:rgba(59,130,246,0.1);color:var(--accent-blue);border:1px solid rgba(59,130,246,0.2)}
  .badge-purple{background:rgba(139,92,246,0.1);color:var(--accent-purple);border:1px solid rgba(139,92,246,0.2)}
  .badge-slate{background:rgba(148,163,184,0.08);color:var(--text-secondary);border:1px solid rgba(148,163,184,0.15)}
  .badge-cyan{background:rgba(6,182,212,0.1);color:var(--accent-cyan);border:1px solid rgba(6,182,212,0.2)}

  /* ─── Toggle Switch ─── */
  .toggle{position:relative;width:42px;height:24px;display:inline-block;flex-shrink:0}
  .toggle input{opacity:0;width:0;height:0;position:absolute}
  .toggle .slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.08);border-radius:12px;transition:var(--transition);border:1px solid var(--border-subtle)}
  .toggle .slider:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--text-muted);border-radius:50%;transition:var(--transition)}
  .toggle input:checked+.slider{background:rgba(16,185,129,0.15);border-color:rgba(16,185,129,0.3)}
  .toggle input:checked+.slider:before{transform:translateX(18px);background:var(--accent-green);box-shadow:0 0 8px rgba(16,185,129,0.4)}
  .toggle-sm{width:36px;height:20px}
  .toggle-sm .slider:before{height:14px;width:14px;left:3px;bottom:3px}
  .toggle-sm input:checked+.slider:before{transform:translateX(16px)}

  /* ─── Forms ─── */
  .form-card{background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:24px;margin-bottom:24px}
  .form-card h3{font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
  .form-group{display:flex;flex-direction:column;gap:6px}
  .form-group label{font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px}
  .form-group input,.form-group textarea,.form-group select{padding:11px 14px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:10px;color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;transition:var(--transition)}
  .form-group input:focus,.form-group textarea:focus,.form-group select:focus{border-color:var(--border-active);box-shadow:0 0 0 3px rgba(59,130,246,0.08)}
  .form-group input::placeholder,.form-group textarea::placeholder{color:var(--text-muted)}
  .form-group textarea{resize:vertical;min-height:80px}
  .form-group select{cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
  .form-actions{margin-top:16px;display:flex;gap:8px}

  /* ─── Buttons ─── */
  .btn{padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:var(--transition);display:inline-flex;align-items:center;gap:6px;letter-spacing:0.1px}
  .btn:active{transform:scale(0.98)}
  .btn-primary{background:linear-gradient(135deg,var(--accent-blue),var(--accent-purple));color:#fff;box-shadow:0 4px 16px rgba(59,130,246,0.2)}
  .btn-primary:hover{box-shadow:0 6px 24px rgba(59,130,246,0.3);transform:translateY(-1px)}
  .btn-secondary{background:rgba(255,255,255,0.05);color:var(--text-secondary);border:1px solid var(--border-subtle)}
  .btn-secondary:hover{background:rgba(255,255,255,0.08);color:var(--text-primary);border-color:var(--border-medium)}
  .btn-danger{background:rgba(244,63,94,0.08);color:var(--accent-rose);border:1px solid rgba(244,63,94,0.15)}
  .btn-danger:hover{background:rgba(244,63,94,0.15);border-color:rgba(244,63,94,0.3)}
  .btn-ghost{background:transparent;color:var(--text-secondary);padding:8px 12px}
  .btn-ghost:hover{background:rgba(255,255,255,0.05);color:var(--text-primary)}
  .btn-sm{padding:6px 12px;font-size:12px;border-radius:8px}
  .btn-icon{width:34px;height:34px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid var(--border-subtle);color:var(--text-secondary);cursor:pointer;transition:var(--transition);font-size:14px}
  .btn-icon:hover{background:rgba(255,255,255,0.08);color:var(--text-primary);border-color:var(--border-medium)}
  .btn-icon.danger:hover{background:rgba(244,63,94,0.1);color:var(--accent-rose);border-color:rgba(244,63,94,0.2)}
  .btn-icon.edit:hover{background:rgba(245,158,11,0.1);color:var(--accent-amber);border-color:rgba(245,158,11,0.2)}
  .btn-icon.fetch:hover{background:rgba(6,182,212,0.1);color:var(--accent-cyan);border-color:rgba(6,182,212,0.2)}

  /* ─── Section Headers ─── */
  .section-header{display:flex;align-items:center;gap:10px;margin:28px 0 14px;font-size:14px;font-weight:600;color:var(--text-primary)}
  .section-header .section-count{margin-left:auto;font-size:12px;font-weight:500;color:var(--text-muted)}

  /* ─── Alert ─── */
  .alert{padding:12px 16px;border-radius:var(--radius);font-size:13px;margin-bottom:20px;display:flex;align-items:center;gap:8px}
  .alert-green{background:rgba(16,185,129,0.08);color:var(--accent-green);border:1px solid rgba(16,185,129,0.15)}
  .alert-blue{background:rgba(59,130,246,0.08);color:var(--accent-blue);border:1px solid rgba(59,130,246,0.15)}

  /* ─── Mono ─── */
  .mono{font-family:'SF Mono','Fira Code',Consolas,'Liberation Mono',Menlo,monospace;font-size:12px}

  /* ─── Mobile ─── */
  @media(max-width:768px){
    .sidebar{width:100%;height:auto;position:relative;flex-direction:row;overflow-x:auto;backdrop-filter:none}
    .sidebar-brand{display:none}
    .nav-section{display:flex;gap:4px;padding:8px;overflow-x:auto;flex:1}
    .nav-label{display:none}
    .nav-item{padding:8px 14px;font-size:12px;white-space:nowrap;border-radius:8px}
    .nav-item span{display:none}
    .nav-item svg{width:16px;height:16px}
    .sidebar-bottom{display:none}
    .main{margin-left:0;padding:16px}
    .stat-grid{grid-template-columns:1fr 1fr}
    .page-header{flex-direction:column;align-items:flex-start}
  }
</style>
</head>
<body>

<nav class="sidebar">
  <div class="sidebar-brand">
    <div class="brand-row">
      <div class="brand-icon">⚡</div>
      <div class="brand-text">
        <h1>CFRouter</h1>
        <p>Proxy Gateway</p>
      </div>
    </div>
  </div>
  <div class="nav-section">
    <div class="nav-label">Navigation</div>
    <a href="/admin/analytics" class="nav-item ${activeTab === 'analytics' ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
      <span>Analytics</span>
    </a>
    <a href="/admin/health" class="nav-item ${activeTab === 'health' ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      <span>Health</span>
    </a>
    <a href="/admin/providers" class="nav-item ${activeTab === 'providers' ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
      <span>Providers</span>
    </a>
    <a href="/admin/tokens" class="nav-item ${activeTab === 'tokens' ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
      <span>Tokens</span>
    </a>
    <a href="/admin/docs" class="nav-item ${activeTab === 'docs' ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <span>Docs</span>
    </a>
  </div>
  <div class="sidebar-bottom">
    <a href="/admin/logout" class="nav-item signout">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      <span>Sign Out</span>
    </a>
  </div>
</nav>

<div class="main">
  ${content}
</div>

</body>
</html>`;
}

// ─── Admin: Analytics Tab ────────────────────────────────────────────────

async function renderAdminAnalytics(env, url) {
  const days = parseInt(url.searchParams.get("days") || "7", 10);

  // SQL aggregation: daily usage stats
  // endpoints_data is a nested JSON object like {"/v1/chat:gpt-4o": {calls, tokens}}
  // so we must use json_each() to iterate through the keys
  const { results: dailyStats } = await env.DB.prepare(`
    SELECT date,
           SUM(CAST(json_extract(value, '$.calls') AS INTEGER)) as total_calls,
           SUM(CAST(json_extract(value, '$.total_tokens') AS INTEGER)) as total_tokens,
           SUM(CAST(json_extract(value, '$.prompt_tokens') AS INTEGER)) as prompt_tokens,
           SUM(CAST(json_extract(value, '$.completion_tokens') AS INTEGER)) as completion_tokens
    FROM usage_summary, json_each(endpoints_data)
    WHERE date >= date('now', '-' || ? || ' days')
    GROUP BY date
    ORDER BY date ASC
  `).bind(days).all();

  // SQL aggregation: per-model breakdown
  const { results: modelStats } = await env.DB.prepare(`
    SELECT key,
           SUM(calls) as calls,
           SUM(tokens) as tokens,
           SUM(prompt_tokens) as prompt_tokens,
           SUM(completion_tokens) as completion_tokens
    FROM (
      SELECT key,
             CAST(json_extract(value, '$.calls') AS INTEGER) as calls,
             CAST(json_extract(value, '$.total_tokens') AS INTEGER) as tokens,
             CAST(json_extract(value, '$.prompt_tokens') AS INTEGER) as prompt_tokens,
             CAST(json_extract(value, '$.completion_tokens') AS INTEGER) as completion_tokens
      FROM usage_summary, json_each(endpoints_data)
      WHERE date >= date('now', '-' || ? || ' days')
    )
    GROUP BY key
    ORDER BY calls DESC
  `).bind(days).all();

  // SQL aggregation: per-key breakdown
  const { results: keyStats } = await env.DB.prepare(`
    SELECT COALESCE(k.name, 'anonymous') as key_name,
           SUM(CAST(json_extract(uv.value, '$.calls') AS INTEGER)) as calls,
           SUM(CAST(json_extract(uv.value, '$.total_tokens') AS INTEGER)) as tokens,
           SUM(CAST(json_extract(uv.value, '$.prompt_tokens') AS INTEGER)) as prompt_tokens,
           SUM(CAST(json_extract(uv.value, '$.completion_tokens') AS INTEGER)) as completion_tokens
    FROM usage_summary u
    LEFT JOIN api_keys k ON u.api_key_id = k.id
    JOIN json_each(u.endpoints_data) uv
    WHERE u.date >= date('now', '-' || ? || ' days')
    GROUP BY u.api_key_id
    ORDER BY calls DESC
  `).bind(days).all();

  // Calculate totals
  let totalCalls = 0, totalTokens = 0, totalPromptTokens = 0, totalCompletionTokens = 0;
  const maxDailyCalls = Math.max(...dailyStats.map(d => d.total_calls || 0), 1);

  const dailyBars = dailyStats.map(d => {
    const calls = d.total_calls || 0;
    const tokens = d.total_tokens || 0;
    totalCalls += calls;
    totalTokens += tokens;
    totalPromptTokens += d.prompt_tokens || 0;
    totalCompletionTokens += d.completion_tokens || 0;
    const height = Math.max(2, (calls / maxDailyCalls) * 100);
    const dateShort = d.date ? d.date.substring(5) : '';
    return `<div class="chart-bar-wrap" title="${d.date}: ${calls} requests, ${tokens.toLocaleString()} tokens">
      <div class="chart-bar" style="height:${height}%"></div>
      <div class="chart-label">${dateShort}</div>
    </div>`;
  }).join('');

  // Active keys count
  const { results: activeKeys } = await env.DB.prepare("SELECT COUNT(*) as count FROM api_keys WHERE enabled = 1").all();
  const keyCount = activeKeys[0]?.count || 0;

  const modelRows = modelStats.map(m => {
    const [endpoint, ...modelParts] = (m.key || '').split(':');
    const model = modelParts.join(':') || 'unknown';
    const pct = totalCalls > 0 ? ((m.calls / totalCalls) * 100).toFixed(1) : 0;
    return `<tr>
      <td style="font-weight:500">${model}</td>
      <td><span class="badge badge-slate">${endpoint}</span></td>
      <td style="text-align:center;font-weight:600">${m.calls}</td>
      <td class="mono" style="color:#60a5fa">${(m.prompt_tokens || 0).toLocaleString()}</td>
      <td class="mono" style="color:#a78bfa">${(m.completion_tokens || 0).toLocaleString()}</td>
      <td class="mono" style="color:var(--text-secondary)">${(m.tokens || 0).toLocaleString()}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--accent-blue);border-radius:3px"></div>
          </div>
          <span style="font-size:11px;color:var(--text-muted);min-width:40px">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  const keyRows = keyStats.map(k => `<tr>
    <td style="font-weight:500">${k.key_name}</td>
    <td style="text-align:center;font-weight:600">${k.calls}</td>
    <td class="mono" style="color:#60a5fa">${(k.prompt_tokens || 0).toLocaleString()}</td>
    <td class="mono" style="color:#a78bfa">${(k.completion_tokens || 0).toLocaleString()}</td>
    <td class="mono" style="color:var(--text-secondary)">${(k.tokens || 0).toLocaleString()}</td>
  </tr>`).join('');

  const content = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>📊 Analytics</h2>
        <p>Usage metrics and consumption insights</p>
      </div>
      <div class="page-header-actions">
        <a href="?days=7" class="btn btn-sm ${days === 7 ? 'btn-primary' : 'btn-secondary'}">7 Days</a>
        <a href="?days=30" class="btn btn-sm ${days === 30 ? 'btn-primary' : 'btn-secondary'}">30 Days</a>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card blue">
        <div class="label">Total Requests</div>
        <div class="value">${totalCalls.toLocaleString()}</div>
        <div class="sub">Last ${days} days</div>
      </div>
      <div class="stat-card green">
        <div class="label">Total Tokens</div>
        <div class="value">${totalTokens.toLocaleString()}</div>
      </div>
      <div class="stat-card orange">
        <div class="label">⬇️ Input Tokens</div>
        <div class="value">${totalPromptTokens.toLocaleString()}</div>
        <div class="sub">Prompt / Context</div>
      </div>
      <div class="stat-card purple">
        <div class="label">⬆️ Output Tokens</div>
        <div class="value">${totalCompletionTokens.toLocaleString()}</div>
        <div class="sub">Generated</div>
      </div>
      <div class="stat-card cyan">
        <div class="label">Active Keys</div>
        <div class="value">${keyCount}</div>
      </div>
      <div class="stat-card slate">
        <div class="label">Models Used</div>
        <div class="value">${modelStats.length}</div>
      </div>
    </div>

    <!-- Daily Usage Chart -->
    <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:24px;margin-bottom:24px">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:20px;color:var(--text-primary)">📈 Daily Requests</h3>
      <div class="chart-container">
        ${dailyStats.length === 0
          ? '<div style="text-align:center;padding:40px;color:var(--text-muted)">No data for this period</div>'
          : `<div class="chart-grid">
              <div class="chart-y-axis">
                <span>${maxDailyCalls}</span>
                <span>${Math.floor(maxDailyCalls / 2)}</span>
                <span>0</span>
              </div>
              <div class="chart-bars">${dailyBars}</div>
            </div>`
        }
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <!-- Per-Model Breakdown -->
      <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius);overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle)">
          <h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">🤖 By Model</h3>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Model</th><th>Endpoint</th><th style="text-align:center">Calls</th><th>Input</th><th>Output</th><th>Total</th><th>Share</th></tr>
            </thead>
            <tbody>
              ${modelRows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted)">No data</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Per-Key Breakdown -->
      <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius);overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle)">
          <h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">🔑 By API Key</h3>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Key Name</th><th style="text-align:center">Calls</th><th>Input</th><th>Output</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${keyRows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">No data</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <style>
      .chart-container{position:relative}
      .chart-grid{display:flex;gap:12px;height:200px;align-items:stretch}
      .chart-y-axis{display:flex;flex-direction:column;justify-content:space-between;font-size:10px;color:var(--text-muted);text-align:right;min-width:30px;padding-bottom:24px}
      .chart-bars{flex:1;display:flex;align-items:flex-end;gap:4px;padding-bottom:24px}
      .chart-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
      .chart-bar{width:100%;background:linear-gradient(180deg,var(--accent-blue),rgba(59,130,246,0.4));border-radius:4px 4px 0 0;transition:var(--transition);min-height:2px}
      .chart-bar:hover{background:linear-gradient(180deg,var(--accent-purple),rgba(139,92,246,0.6));box-shadow:0 0 12px rgba(59,130,246,0.3)}
      .chart-label{font-size:9px;color:var(--text-muted);margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-align:center}
    </style>
  `;

  return new Response(adminLayout("Analytics", "analytics", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── Admin: Health Tab ───────────────────────────────────────────────────

async function renderAdminHealth(env) {
  const { results: customProviders } = await env.DB.prepare(
    "SELECT * FROM custom_providers ORDER BY enabled ASC, name ASC"
  ).all();

  const total = customProviders ? customProviders.length : 0;
  const active = customProviders ? customProviders.filter(p => p.enabled === 1).length : 0;
  const disabledCount = customProviders ? customProviders.filter(p => p.enabled === 0).length : 0;

  // Calculate total tokens
  let totalTokens = 0;
  let activeTokens = 0;
  (customProviders || []).forEach(p => {
    const tokens = parseTokens(p.tokens);
    totalTokens += tokens.length;
    activeTokens += tokens.filter(t => t.enabled).length;
  });

  const providerRows = (customProviders || []).map(p => {
    const tokens = parseTokens(p.tokens);
    const models = JSON.parse(p.fetched_models || "[]");
    const modelCount = Array.isArray(models) ? models.length : 0;
    const enabledTokens = tokens.filter(t => t.enabled).length;

    let statusBadge;
    if (!p.enabled) statusBadge = '<span class="badge badge-slate">Disabled</span>';
    else statusBadge = '<span class="badge badge-green">Active</span>';

    return `<tr style="${p.enabled ? '' : 'opacity:0.5;'}">
      <td style="font-weight:600">${p.name}</td>
      <td class="mono" style="color:var(--text-secondary);font-size:12px">${p.base_url}</td>
      <td>${statusBadge}</td>
      <td style="text-align:center;font-weight:600">${modelCount}</td>
      <td style="text-align:center;font-weight:600;color:${enabledTokens > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}">${enabledTokens}/${tokens.length}</td>
    </tr>`;
  }).join("");

  const content = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Health Monitor</h2>
        <p>Provider status and routing health</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card cyan">
        <div class="label">Total Providers</div>
        <div class="value">${total}</div>
      </div>
      <div class="stat-card green">
        <div class="label">Active</div>
        <div class="value">${active}</div>
      </div>
      <div class="stat-card amber">
        <div class="label">Disabled</div>
        <div class="value">${disabledCount}</div>
      </div>
      <div class="stat-card purple">
        <div class="label">API Tokens</div>
        <div class="value">${activeTokens}</div>
        <div class="sub">of ${totalTokens} total</div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Provider</th><th>Base URL</th><th>Status</th><th style="text-align:center">Models</th><th style="text-align:center">Tokens</th></tr>
          </thead>
          <tbody>${providerRows || '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No providers configured</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  return new Response(adminLayout("Health", "health", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── Admin: Providers Tab ────────────────────────────────────────────────

// Generate a URL-safe slug from provider name for model ID prefixing
// e.g. "My OpenAI Proxy" -> "my-openai-proxy", "CloudFlare" -> "cloudflare"
function providerSlug(name) {
  return (name || "provider")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 32) || "provider";
}

function parseTokens(tokensRaw) {
  try {
    const arr = JSON.parse(tokensRaw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map(t => {
      if (typeof t === "string") return { value: t, enabled: true, name: "" };
      return { value: t.value || "", enabled: t.enabled !== false, name: t.name || "" };
    });
  } catch (e) { return []; }
}

function tokensToJSON(tokens) {
  return JSON.stringify(tokens.map(t => ({ value: t.value, enabled: t.enabled, name: t.name || "" })));
}

// ─── Token Selection Strategy ────────────────────────────────────────────
// In-memory round-robin counters (per-isolate, reset on cold start — acceptable for CF Workers)
const _roundRobinCounters = {};

async function selectToken(tokens, strategy, providerId, env) {
  // Filter to enabled tokens, preserving original indices for least-used tracking
  const enabledTokens = tokens
    .map((t, i) => ({ ...t, _originalIndex: i }))
    .filter(t => t.enabled && t.value);

  if (enabledTokens.length === 0) return null;
  if (enabledTokens.length === 1) return enabledTokens[0];

  switch (strategy) {
    case 'round-robin': {
      const counter = (_roundRobinCounters[providerId] || 0);
      const idx = counter % enabledTokens.length;
      _roundRobinCounters[providerId] = counter + 1;
      return enabledTokens[idx];
    }
    case 'random': {
      const idx = Math.floor(Math.random() * enabledTokens.length);
      return enabledTokens[idx];
    }
    case 'least-used': {
      try {
        const { results } = await env.DB.prepare(
          "SELECT token_index, calls FROM token_usage WHERE provider_id = ?"
        ).bind(providerId).all();
        const usageMap = {};
        (results || []).forEach(r => { usageMap[r.token_index] = r.calls || 0; });

        let minCalls = Infinity;
        let bestTokens = [];
        for (const t of enabledTokens) {
          const calls = usageMap[t._originalIndex] || 0;
          if (calls < minCalls) {
            minCalls = calls;
            bestTokens = [t];
          } else if (calls === minCalls) {
            bestTokens.push(t);
          }
        }
        return bestTokens[Math.floor(Math.random() * bestTokens.length)];
      } catch (e) {
        return enabledTokens[Math.floor(Math.random() * enabledTokens.length)];
      }
    }
    case 'sequential':
    default:
      return enabledTokens[0];
  }
}

async function renderAdminProviders(env) {
  const { results: customProviders } = await env.DB.prepare(
    "SELECT * FROM custom_providers ORDER BY created_at DESC"
  ).all();

  const customTotal = customProviders ? customProviders.length : 0;
  const customEnabled = customProviders ? customProviders.filter(p => p.enabled === 1).length : 0;

  // Calculate total models and tokens across all providers
  let totalModels = 0;
  let totalTokens = 0;
  (customProviders || []).forEach(p => {
    try {
      const models = JSON.parse(p.fetched_models || "[]");
      if (Array.isArray(models)) totalModels += models.length;
    } catch (e) {}
    const tokens = parseTokens(p.tokens);
    totalTokens += tokens.filter(t => t.enabled).length;
  });

  // Build provider cards
  const providerCards = (customProviders || []).map(p => {
    const tokens = parseTokens(p.tokens);
    const models = JSON.parse(p.fetched_models || "[]");
    const enabledCount = tokens.filter(t => t.enabled).length;
    const totalCount = tokens.length;
    const modelCount = Array.isArray(models) ? models.length : 0;
    const slug = p.slug || providerSlug(p.name);

    return `
    <div class="provider-card" data-provider-id="${p.id}" data-name="${p.name}" data-slug="${slug}" data-enabled="${p.enabled}" style="background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);overflow:hidden;transition:var(--transition);${p.enabled ? '' : 'opacity:0.55;'}">
      <a href="/admin/providers/${p.id}" style="text-decoration:none;color:inherit;display:block;padding:20px 24px;">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,${p.enabled ? 'rgba(16,185,129,0.12),rgba(59,130,246,0.12)' : 'rgba(148,163,184,0.06),rgba(148,163,184,0.04)'});display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;border:1px solid ${p.enabled ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)'}">
            🔌
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="font-size:15px;font-weight:700;color:var(--text-primary)">${p.name}</div>
              <span class="badge ${p.enabled ? 'badge-green' : 'badge-slate'}" style="font-size:9px">${p.enabled ? 'Active' : 'Disabled'}</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'SF Mono',Consolas,monospace">${p.base_url}</div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;flex-shrink:0">
            <div style="text-align:center">
              <div style="font-size:18px;font-weight:800;color:var(--accent-blue)">${modelCount}</div>
              <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Models</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:18px;font-weight:800;color:${enabledCount > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}">${enabledCount}/${totalCount}</div>
              <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Tokens</div>
            </div>
          </div>
        </div>
      </a>
      <div style="padding:0 24px 16px;display:flex;align-items:center;gap:10px">
        <form method="POST" action="/admin/providers/toggle" style="display:inline">
          <input type="hidden" name="id" value="${p.id}">
          <label class="toggle toggle-sm">
            <input type="submit" style="display:none">
            <input type="checkbox" ${p.enabled ? 'checked' : ''} onchange="this.form.submit()">
            <span class="slider"></span>
          </label>
        </form>
        <button type="button" class="btn btn-sm btn-secondary" onclick="testProvider('${p.id}')" style="font-size:11px;padding:4px 12px;border-radius:8px">Test</button>
        <div style="margin-left:auto;display:flex;gap:6px">
          <form method="POST" action="/admin/providers/delete" onsubmit="return confirm('Delete provider \\'${p.name}\\'? This cannot be undone.')" style="display:inline">
            <input type="hidden" name="id" value="${p.id}">
            <button type="submit" class="btn-icon danger" title="Delete" style="font-size:12px;padding:4px 8px">✕</button>
          </form>
        </div>
      </div>
    </div>`;
  }).join("");

  const content = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Providers</h2>
        <p>Manage AI providers, API keys, and load balancing</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="document.getElementById('addProviderSection').style.display=document.getElementById('addProviderSection').style.display==='none'?'block':'none'">+ Add Provider</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card blue">
        <div class="label">Total Providers</div>
        <div class="value">${customTotal}</div>
        <div class="sub">${customEnabled} active</div>
      </div>
      <div class="stat-card green">
        <div class="label">Active</div>
        <div class="value">${customEnabled}</div>
      </div>
      <div class="stat-card purple">
        <div class="label">Models</div>
        <div class="value">${totalModels}</div>
        <div class="sub">fetched from providers</div>
      </div>
      <div class="stat-card amber">
        <div class="label">Tokens</div>
        <div class="value">${totalTokens}</div>
        <div class="sub">API keys enabled</div>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;align-items:center">
      <div style="flex:1;min-width:240px;position:relative">
        <svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);opacity:0.4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" id="provider-search" placeholder="Search providers..." style="width:100%;padding:10px 14px 10px 40px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius);color:var(--text-primary);font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:var(--transition)" onfocus="this.style.borderColor='var(--border-active)'" onblur="this.style.borderColor='var(--border-subtle)'" oninput="filterProviders()">
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm filter-btn active" data-filter="all" onclick="setFilter('all')">All</button>
        <button class="btn btn-sm filter-btn" data-filter="active" onclick="setFilter('active')">Active</button>
        <button class="btn btn-sm filter-btn" data-filter="disabled" onclick="setFilter('disabled')">Disabled</button>
      </div>
    </div>

    <!-- Add Provider Form -->
    <div id="addProviderSection" style="display:none;margin-bottom:24px;background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:24px">
      <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:16px">Add New Provider</h3>
      <form method="POST" action="/admin/providers/add">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label>Provider Name</label>
            <input type="text" name="name" placeholder="e.g. My OpenAI Proxy" required>
          </div>
          <div class="form-group">
            <label>Provider ID (slug)</label>
            <input type="text" name="slug" placeholder="e.g. my-openai-proxy" pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only">
            <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block">Used in model IDs: <code id="slug-preview">slug/model-name</code></small>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Base URL</label>
            <input type="url" name="base_url" placeholder="https://api.example.com/v1" required>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>API Tokens (one per line)</label>
            <textarea name="tokens" placeholder="sk-token-1&#10;sk-token-2&#10;sk-token-3" required></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Add Provider</button>
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('addProviderSection').style.display='none'">Cancel</button>
        </div>
      </form>
      <script>
        document.querySelector('#addProviderSection input[name="name"]').addEventListener('input', function() {
          const slug = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 32) || 'provider';
          document.getElementById('slug-preview').textContent = slug + '/model-name';
          const slugInput = document.querySelector('#addProviderSection input[name="slug"]');
          if (!slugInput.dataset.touched) slugInput.value = slug;
        });
        document.querySelector('#addProviderSection input[name="slug"]').addEventListener('input', function() {
          this.dataset.touched = 'true';
        });
      </script>
    </div>

    <!-- Provider Cards Grid -->
    <div id="provider-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:32px">
      ${providerCards || '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px dashed var(--border-medium);grid-column:1/-1">No providers yet. Click "+ Add Provider" to add your first AI provider.</div>'}
    </div>

    <script>
    var currentFilter = 'all';
    function setFilter(f) {
      currentFilter = f;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
      filterProviders();
    }
    function filterProviders() {
      var q = (document.getElementById('provider-search').value || '').toLowerCase();
      document.querySelectorAll('.provider-card').forEach(card => {
        var name = (card.dataset.name || '').toLowerCase();
        var slug = (card.dataset.slug || '').toLowerCase();
        var enabled = card.dataset.enabled === '1';
        var matchSearch = !q || name.includes(q) || slug.includes(q);
        var matchFilter = currentFilter === 'all' || (currentFilter === 'active' && enabled) || (currentFilter === 'disabled' && !enabled);
        card.style.display = (matchSearch && matchFilter) ? '' : 'none';
      });
    }
    function testProvider(id) {
      fetch('/admin/providers/test', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id})})
        .then(r => r.json()).then(d => { alert(d.ok ? 'Provider is reachable!' : ('Error: ' + (d.error || 'Unknown error'))); })
        .catch(e => { alert('Test failed: ' + e.message); });
    }
    </script>

    <style>
      .filter-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:500;background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-secondary);cursor:pointer;transition:var(--transition)}
      .filter-btn:hover{border-color:var(--border-medium);color:var(--text-primary)}
      .filter-btn.active{background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:var(--accent-blue)}
      @media(max-width:1100px){#provider-grid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:700px){#provider-grid{grid-template-columns:1fr}}
  `;

  return new Response(adminLayout("Providers", "providers", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── Admin: Model Aliases Tab ──────────────────────────────────────────

async function renderAdminAliases(env) {
  const { results: aliases } = await env.DB.prepare(
    "SELECT * FROM model_aliases ORDER BY enabled DESC, alias ASC"
  ).all();

  const total = aliases ? aliases.length : 0;
  const enabledCount = aliases ? aliases.filter(a => a.enabled === 1).length : 0;

  const aliasRows = (aliases || []).map(a => `
    <tr style="${a.enabled ? '' : 'opacity:0.5;'}">
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="mono" style="color:var(--accent-blue);font-weight:600">${a.alias}</span>
          ${a.enabled ? '' : '<span class="badge badge-slate" style="font-size:9px">Disabled</span>'}
        </div>
      </td>
      <td class="mono" style="color:var(--text-secondary);font-size:12px">${a.model_id}</td>
      <td style="font-weight:500">${a.display_name || '—'}</td>
      <td class="mono" style="color:var(--text-muted)">${a.context_window ? (a.context_window / 1000).toFixed(0) + 'k' : '—'}</td>
      <td style="text-align:center">
        <form method="POST" action="/admin/aliases/toggle" style="display:inline">
          <input type="hidden" name="id" value="${a.id}">
          <label class="toggle toggle-sm">
            <input type="submit" style="display:none">
            <input type="checkbox" ${a.enabled ? 'checked' : ''} onchange="this.form.submit()">
            <span class="slider"></span>
          </label>
        </form>
      </td>
      <td style="text-align:right">
        <div style="display:flex;gap:6px;justify-content:flex-end">
          <button type="button" class="btn-icon edit" onclick="openEditAliasModal(${a.id})" title="Edit">✏️</button>
          <form method="POST" action="/admin/aliases/delete" onsubmit="return confirm('Delete this alias? Users who use \`${a.alias}\` will no longer be able to.')" style="display:inline">
            <input type="hidden" name="id" value="${a.id}">
            <button type="submit" class="btn-icon danger" title="Delete">✕</button>
          </form>
        </div>
      </td>
    </tr>
  `).join("");

  const content = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Model Aliases</h2>
        <p>Short names that map to full model IDs from your providers</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="document.getElementById('addAliasSection').style.display=document.getElementById('addAliasSection').style.display==='none'?'block':'none'">+ New Alias</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card blue">
        <div class="label">Total Aliases</div>
        <div class="value">${total}</div>
      </div>
      <div class="stat-card green">
        <div class="label">Active</div>
        <div class="value">${enabledCount}</div>
      </div>
      <div class="stat-card amber">
        <div class="label">Disabled</div>
        <div class="value">${total - enabledCount}</div>
      </div>
    </div>

    <!-- Add Alias Form -->
    <div id="addAliasSection" class="form-card" style="display:none">
      <h3>➕ Add Model Alias</h3>
      <form method="POST" action="/admin/aliases/add">
        <div class="form-grid">
          <div class="form-group">
            <label>Alias (Short Name)</label>
            <input type="text" name="alias" placeholder="e.g. gpt-4o" required pattern="[a-z0-9._-]+" style="font-family:'SF Mono',Consolas,monospace">
            <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block">Users send this in the <code>model</code> field</small>
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" name="display_name" placeholder="e.g. GPT-4o">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Full Model ID</label>
            <input type="text" name="model_id" placeholder="e.g. openai/gpt-4o" required style="font-family:'SF Mono',Consolas,monospace">
          </div>
          <div class="form-group">
            <label>Context Window</label>
            <input type="number" name="context_window" placeholder="e.g. 128000" min="0">
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Add Alias</button>
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('addAliasSection').style.display='none'">Cancel</button>
        </div>
      </form>
    </div>

    <!-- Alias Table -->
    <div class="table-wrap">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Alias</th>
              <th>Full Model ID</th>
              <th>Display Name</th>
              <th>Context</th>
              <th style="text-align:center">Enabled</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${aliasRows || '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No aliases configured. Add one above to create a short model name.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Info -->
    <div style="margin-top:20px;padding:16px 20px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);line-height:1.6">
      <strong style="color:var(--accent-blue)">ℹ️ How aliases work:</strong><br>
      When a user sends a request with <code style="color:var(--accent-blue)">model: "gpt-oss-120b"</code>, the gateway resolves it to the full model ID before forwarding.
      The response model field is rewritten back to the alias name so users always see their short name.
      Both the alias and full model ID work — they just route to the same provider.
    </div>

    <!-- Edit Alias Modal -->
    <div id="editAliasModal" class="modal-overlay" onclick="if(event.target===this)this.classList.remove('show')">
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Alias</h3>
          <button onclick="this.closest('.modal-overlay').classList.remove('show')" class="modal-close">&times;</button>
        </div>
        <form method="POST" action="/admin/aliases/edit">
          <input type="hidden" id="ea-id" name="id">
          <div class="form-group" style="margin-bottom:16px">
            <label>Alias (Short Name)</label>
            <input type="text" id="ea-alias" name="alias" required pattern="[a-z0-9._-]+" style="font-family:'SF Mono',Consolas,monospace">
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label>Full Model ID</label>
            <input type="text" id="ea-model-id" name="model_id" required style="font-family:'SF Mono',Consolas,monospace">
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label>Display Name</label>
            <input type="text" id="ea-display-name" name="display_name">
          </div>
          <div class="form-group" style="margin-bottom:20px">
            <label>Context Window</label>
            <input type="number" id="ea-context" name="context_window" min="0">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <button type="button" onclick="this.closest('.modal-overlay').classList.remove('show')" class="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <style>
      .modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:200;align-items:center;justify-content:center}
      .modal-overlay.show{display:flex}
      .modal{background:var(--bg-secondary);backdrop-filter:blur(24px);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:500px;box-shadow:0 25px 60px rgba(0,0,0,0.5)}
      .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
      .modal-header h3{margin:0;font-size:16px;font-weight:700;color:var(--text-primary)}
      .modal-close{background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0;line-height:1;transition:var(--transition)}
      .modal-close:hover{color:var(--text-primary)}
    </style>

    <script>
    var aliasData = ${JSON.stringify((aliases || []).reduce((m, a) => { m[a.id] = {alias: a.alias, model_id: a.model_id, display_name: a.display_name || '', context_window: a.context_window || 0}; return m; }, {}))};
    function openEditAliasModal(id) {
      var d = aliasData[id];
      if (!d) return;
      document.getElementById('ea-id').value = id;
      document.getElementById('ea-alias').value = d.alias;
      document.getElementById('ea-model-id').value = d.model_id;
      document.getElementById('ea-display-name').value = d.display_name;
      document.getElementById('ea-context').value = d.context_window || '';
      document.getElementById('editAliasModal').classList.add('show');
    }
    </script>
  `;

  return new Response(adminLayout("Model Aliases", "aliases", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── Admin: Tokens Tab ──────────────────────────────────────────────────

async function renderAdminTokens(env, url) {
  const { results: tokens } = await env.DB.prepare(
    "SELECT * FROM api_keys ORDER BY created_at DESC"
  ).all();

  const totalCount = tokens ? tokens.length : 0;
  const enabledCount = tokens ? tokens.filter(t => t.enabled === 1).length : 0;

  const tokenRows = (tokens || []).map(t => {
    const statusBadge = t.enabled === 1
      ? '<span class="badge badge-green">Active</span>'
      : '<span class="badge badge-rose">Disabled</span>';
    const lastUsed = t.last_used_at ? new Date(t.last_used_at + 'Z').toLocaleDateString() : 'Never';
    const created = t.created_at ? new Date(t.created_at + 'Z').toLocaleDateString() : 'Unknown';

    return `<tr data-name="${(t.name || '').toLowerCase()}">
      <td><strong>${t.name}</strong></td>
      <td><span class="mono" style="color:var(--accent-cyan)">${t.key_prefix}</span></td>
      <td>${statusBadge}</td>
      <td style="color:var(--text-secondary)">${created}</td>
      <td style="color:var(--text-secondary)">${lastUsed}</td>
      <td>
        <div style="display:flex;gap:6px">
          <form method="POST" action="/admin/tokens/toggle" style="display:inline">
            <input type="hidden" name="id" value="${t.id}">
            <button type="submit" class="btn-icon ${t.enabled === 1 ? 'edit' : ''}" title="${t.enabled === 1 ? 'Disable' : 'Enable'}">
              ${t.enabled === 1 ? '⏸' : '▶'}
            </button>
          </form>
          <button class="btn-icon edit" title="Rename" onclick="openRenameModal(${t.id}, '${(t.name || '').replace(/'/g, "\\'")}')">✏️</button>
          <form method="POST" action="/admin/tokens/delete" style="display:inline" onsubmit="return confirm('Delete this token?')">
            <input type="hidden" name="id" value="${t.id}">
            <button type="submit" class="btn-icon danger" title="Delete">🗑</button>
          </form>
        </div>
      </td>
    </tr>`;
  }).join('');

  const content = `
    <style>
      .modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:200;align-items:center;justify-content:center}
      .modal-overlay.show{display:flex}
      .modal{background:var(--bg-secondary);backdrop-filter:blur(24px);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:500px;box-shadow:0 25px 60px rgba(0,0,0,0.5)}
      .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
      .modal-header h3{margin:0;font-size:16px;font-weight:700;color:var(--text-primary)}
      .modal-close{background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0;line-height:1;transition:var(--transition)}
      .modal-close:hover{color:var(--text-primary)}
    </style>

    <div class="page-header">
      <div class="page-header-left">
        <h2>🔑 API Tokens</h2>
        <p>Manage API keys for proxy access</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="document.getElementById('createTokenModal').classList.add('show')">
          + Create Token
        </button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card blue">
        <div class="label">Total Tokens</div>
        <div class="value">${totalCount}</div>
      </div>
      <div class="stat-card green">
        <div class="label">Active</div>
        <div class="value">${enabledCount}</div>
      </div>
      <div class="stat-card rose">
        <div class="label">Disabled</div>
        <div class="value">${totalCount - enabledCount}</div>
      </div>
    </div>

    <div class="table-wrap">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border-subtle)">
        <input type="text" id="tokenSearch" placeholder="Search tokens..." oninput="filterTokens()" style="width:100%;padding:10px 14px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:10px;color:var(--text-primary);font-size:13px;outline:none">
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key Prefix</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="tokenTableBody">
            ${tokenRows || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">No tokens yet. Create one to get started.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div style="margin-top:24px;padding:16px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius)">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:8px">📖 Usage</h3>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Include your API key in requests:</p>
      <pre style="background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;font-size:12px;color:var(--accent-cyan);overflow-x:auto">curl -H "Authorization: Bearer sk-your-key-here" https://your-worker.dev/v1/chat/completions</pre>
    </div>

    <!-- Create Token Modal -->
    <div class="modal-overlay" id="createTokenModal">
      <div class="modal">
        <div class="modal-header">
          <h3>Create New Token</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').classList.remove('show')">&times;</button>
        </div>
        <form method="POST" action="/admin/tokens/create">
          <div class="form-group" style="margin-bottom:16px">
            <label>Token Name</label>
            <input type="text" name="name" required placeholder="e.g., My App, VSCode, Cline" style="width:100%;padding:11px 14px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:10px;color:var(--text-primary);font-size:13px;outline:none">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" onclick="this.closest('.modal-overlay').classList.remove('show')" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Token</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Rename Token Modal -->
    <div class="modal-overlay" id="renameTokenModal">
      <div class="modal">
        <div class="modal-header">
          <h3>Rename Token</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').classList.remove('show')">&times;</button>
        </div>
        <form method="POST" action="/admin/tokens/rename">
          <input type="hidden" name="id" id="rn-id">
          <div class="form-group" style="margin-bottom:16px">
            <label>New Name</label>
            <input type="text" name="name" id="rn-name" required style="width:100%;padding:11px 14px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:10px;color:var(--text-primary);font-size:13px;outline:none">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" onclick="this.closest('.modal-overlay').classList.remove('show')" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Rename</button>
          </div>
        </form>
      </div>
    </div>

    <style>
      .modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:200;align-items:center;justify-content:center}
      .modal-overlay.show{display:flex}
      .modal{background:var(--bg-secondary);backdrop-filter:blur(24px);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:500px;box-shadow:0 25px 60px rgba(0,0,0,0.5)}
      .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
      .modal-header h3{margin:0;font-size:16px;font-weight:700;color:var(--text-primary)}
      .modal-close{background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0;line-height:1;transition:var(--transition)}
      .modal-close:hover{color:var(--text-primary)}
    </style>

    <script>
    function filterTokens() {
      var q = document.getElementById('tokenSearch').value.toLowerCase();
      var rows = document.querySelectorAll('#tokenTableBody tr');
      rows.forEach(function(row) {
        var name = row.getAttribute('data-name') || '';
        row.style.display = name.includes(q) ? '' : 'none';
      });
    }
    function openRenameModal(id, name) {
      document.getElementById('rn-id').value = id;
      document.getElementById('rn-name').value = name;
      document.getElementById('renameTokenModal').classList.add('show');
    }
    </script>
  `;

  return new Response(adminLayout("API Tokens", "tokens", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── Admin: API Docs Tab ────────────────────────────────────────────────

async function renderAdminDocs(env) {
  const content = `
  <style>
    .docs-section{margin-bottom:40px}
    .docs-section h2{font-size:20px;font-weight:700;margin-bottom:16px;color:var(--text-primary);display:flex;align-items:center;gap:8px}
    .docs-section h3{font-size:15px;font-weight:600;margin:20px 0 10px;color:var(--text-primary)}
    .base-url-box{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;backdrop-filter:blur(12px)}
    .base-url-box .url{font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;color:var(--accent);word-break:break-all}
    .auth-box{background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:12px;padding:16px 20px;margin-bottom:16px}
    .auth-box .label{font-size:13px;color:var(--text-secondary);margin-bottom:6px}
    .endpoint-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;margin-bottom:16px;overflow:hidden;backdrop-filter:blur(12px)}
    .endpoint-header{padding:14px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background 0.2s}
    .endpoint-header:hover{background:rgba(255,255,255,0.03)}
    .method-badge{padding:4px 10px;border-radius:6px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;min-width:50px;text-align:center}
    .method-get{background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)}
    .method-post{background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3)}
    .endpoint-path{font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;color:var(--text-primary)}
    .endpoint-desc{font-size:13px;color:var(--text-secondary);margin-left:auto}
    .endpoint-body{padding:0;display:none}
    .endpoint-body.open{display:block}
    .endpoint-body-inner{padding:20px}
    .code-wrapper{position:relative;margin:10px 0}
    .code-wrapper pre{background:#0d1425;border:1px solid var(--border-subtle);border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:13px;line-height:1.5;margin:0;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;color:#e2e8f0}
    .code-wrapper .copy-btn{position:absolute;top:8px;right:8px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;transition:all 0.2s;z-index:2}
    .code-wrapper .copy-btn:hover{background:rgba(99,102,241,0.35);transform:scale(1.05)}
    .code-wrapper .copy-btn.copied{background:rgba(34,197,94,0.2);border-color:rgba(34,197,94,0.3);color:#4ade80}
    .param-table{width:100%;border-collapse:collapse;margin:10px 0}
    .param-table th,.param-table td{padding:10px 14px;text-align:left;font-size:13px;border-bottom:1px solid var(--border-subtle)}
    .param-table th{color:var(--text-secondary);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}
    .param-table td:first-child{font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;color:var(--accent);font-size:13px}
    .param-required{color:#f87171;font-size:11px;font-weight:600}
    .param-optional{color:var(--text-secondary);font-size:11px}
    .info-card{background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px 20px;margin:16px 0}
    .info-card p{color:var(--text-secondary);font-size:13px;line-height:1.6}
    .info-card code{background:rgba(99,102,241,0.15);padding:2px 6px;border-radius:4px;font-size:12px;color:var(--accent)}
    .format-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
    .format-tab{padding:6px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--border-subtle);background:var(--glass-bg);color:var(--text-secondary);transition:all 0.2s}
    .format-tab.active{background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.3);color:var(--accent)}
    .format-tab:hover{border-color:rgba(99,102,241,0.3)}
  </style>

  <div class="page-header">
    <div>
      <h1 class="page-title">API Documentation</h1>
      <p class="page-desc">How to authenticate and call your CFRouter endpoints</p>
    </div>
  </div>

  <!-- Base URL -->
  <div class="docs-section">
    <h2>🔗 Base URL</h2>
    <div class="base-url-box">
      <span class="url" id="baseUrl"></span>
      <button class="copy-btn" onclick="copyText(document.getElementById('baseUrl').textContent)">📋 Copy</button>
    </div>
  </div>

  <!-- Authentication -->
  <div class="docs-section">
    <h2>🔐 Authentication</h2>
    <div class="auth-box">
      <div class="label">Include your API key in the Authorization header:</div>
      <div class="code-wrapper">
        <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
        <pre><code>Authorization: Bearer sk-your-api-key-here</code></pre>
      </div>
    </div>
    <div class="info-card">
      <p>Create API tokens from the <a href="/admin/tokens" style="color:var(--accent)">Tokens</a> page. Each request must include a valid API key in the <code>Authorization</code> header.</p>
    </div>
  </div>

  <!-- Endpoints -->
  <div class="docs-section">
    <h2>📡 Endpoints</h2>

    <!-- GET /v1/models -->
    <div class="endpoint-card">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method-badge method-get">GET</span>
        <span class="endpoint-path">/v1/models</span>
        <span class="endpoint-desc">List all available models</span>
      </div>
      <div class="endpoint-body">
        <div class="endpoint-body-inner">
          <h3>cURL</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>curl -H "Authorization: Bearer sk-your-api-key-here" \\
  https://YOUR_WORKER.workers.dev/v1/models</code></pre>
          </div>
          <h3>Response</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>{
  "object": "list",
  "data": [
    { "id": "openai/gpt-4o", "object": "model", "owned_by": "openai" },
    { "id": "anthropic/claude-3.5-sonnet", "object": "model", "owned_by": "anthropic" }
  ]
}</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- POST /v1/chat/completions -->
    <div class="endpoint-card">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method-badge method-post">POST</span>
        <span class="endpoint-path">/v1/chat/completions</span>
        <span class="endpoint-desc">OpenAI-compatible chat completion</span>
      </div>
      <div class="endpoint-body">
        <div class="endpoint-body-inner">
          <h3>Parameters</h3>
          <table class="param-table">
            <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
            <tr><td>model</td><td>string</td><td><span class="param-required">Required</span></td><td>Model ID (e.g. <code>openai/gpt-4o</code>)</td></tr>
            <tr><td>messages</td><td>array</td><td><span class="param-required">Required</span></td><td>Array of message objects with <code>role</code> and <code>content</code></td></tr>
            <tr><td>temperature</td><td>number</td><td><span class="param-optional">Optional</span></td><td>Sampling temperature (0-2). Default: 1</td></tr>
            <tr><td>max_tokens</td><td>integer</td><td><span class="param-optional">Optional</span></td><td>Maximum tokens to generate</td></tr>
            <tr><td>stream</td><td>boolean</td><td><span class="param-optional">Optional</span></td><td>Enable SSE streaming. Default: false</td></tr>
          </table>
          <h3>cURL</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>curl -X POST https://YOUR_WORKER.workers.dev/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-api-key-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'</code></pre>
          </div>
          <h3>Response</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "model": "openai/gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello! How can I help you today?" },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 25, "completion_tokens": 10, "total_tokens": 35 }
}</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- POST /v1/messages (Anthropic) -->
    <div class="endpoint-card">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method-badge method-post">POST</span>
        <span class="endpoint-path">/v1/messages</span>
        <span class="endpoint-desc">Anthropic Messages API format</span>
      </div>
      <div class="endpoint-body">
        <div class="endpoint-body-inner">
          <h3>Parameters</h3>
          <table class="param-table">
            <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
            <tr><td>model</td><td>string</td><td><span class="param-required">Required</span></td><td>Model ID (e.g. <code>anthropic/claude-3.5-sonnet</code>)</td></tr>
            <tr><td>messages</td><td>array</td><td><span class="param-required">Required</span></td><td>Array of message objects with <code>role</code> and <code>content</code></td></tr>
            <tr><td>max_tokens</td><td>integer</td><td><span class="param-required">Required</span></td><td>Maximum tokens to generate</td></tr>
            <tr><td>system</td><td>string</td><td><span class="param-optional">Optional</span></td><td>System prompt</td></tr>
            <tr><td>stream</td><td>boolean</td><td><span class="param-optional">Optional</span></td><td>Enable SSE streaming. Default: false</td></tr>
          </table>
          <h3>cURL</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>curl -X POST https://YOUR_WORKER.workers.dev/v1/messages \\
  -H "Authorization: Bearer sk-your-api-key-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "anthropic/claude-3.5-sonnet",
    "max_tokens": 1024,
    "system": "You are a helpful assistant.",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'</code></pre>
          </div>
          <h3>Response</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>{
  "id": "msg_abc123",
  "type": "message",
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Hello! How can I help you today?" }
  ],
  "model": "anthropic/claude-3.5-sonnet",
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 25, "output_tokens": 10 }
}</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- POST /v1beta/models/{model}:generateContent (Gemini) -->
    <div class="endpoint-card">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method-badge method-post">POST</span>
        <span class="endpoint-path">/v1beta/models/{model}:generateContent</span>
        <span class="endpoint-desc">Google Gemini API format</span>
      </div>
      <div class="endpoint-body">
        <div class="endpoint-body-inner">
          <h3>Parameters</h3>
          <table class="param-table">
            <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
            <tr><td>contents</td><td>array</td><td><span class="param-required">Required</span></td><td>Array of content parts with <code>role</code> and <code>parts</code></td></tr>
            <tr><td>generationConfig</td><td>object</td><td><span class="param-optional">Optional</span></td><td>Configuration: <code>temperature</code>, <code>maxOutputTokens</code>, etc.</td></tr>
            <tr><td>systemInstruction</td><td>object</td><td><span class="param-optional">Optional</span></td><td>System prompt as <code>{ "parts": [{ "text": "..." }] }</code></td></tr>
          </table>
          <h3>cURL</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>curl -X POST "https://YOUR_WORKER.workers.dev/v1beta/models/gemini-2.0-flash:generateContent" \\
  -H "Authorization: Bearer sk-your-api-key-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [
      { "role": "user", "parts": [{ "text": "Hello!" }] }
    ],
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 1024
    }
  }'</code></pre>
          </div>
          <h3>Response</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>{
  "candidates": [
    {
      "content": {
        "parts": [{ "text": "Hello! How can I help you today?" }],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 25,
    "candidatesTokenCount": 10,
    "totalTokenCount": 35
  }
}</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- POST /v1/embeddings -->
    <div class="endpoint-card">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method-badge method-post">POST</span>
        <span class="endpoint-path">/v1/embeddings</span>
        <span class="endpoint-desc">Create embeddings</span>
      </div>
      <div class="endpoint-body">
        <div class="endpoint-body-inner">
          <h3>Parameters</h3>
          <table class="param-table">
            <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
            <tr><td>model</td><td>string</td><td><span class="param-required">Required</span></td><td>Embedding model ID</td></tr>
            <tr><td>input</td><td>string|array</td><td><span class="param-required">Required</span></td><td>Text(s) to embed</td></tr>
          </table>
          <h3>cURL</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>curl -X POST https://YOUR_WORKER.workers.dev/v1/embeddings \\
  -H "Authorization: Bearer sk-your-api-key-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/text-embedding-3-small",
    "input": "The quick brown fox jumps over the lazy dog"
  }'</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- GET /v1/health -->
    <div class="endpoint-card">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method-badge method-get">GET</span>
        <span class="endpoint-path">/v1/health</span>
        <span class="endpoint-desc">Health check</span>
      </div>
      <div class="endpoint-body">
        <div class="endpoint-body-inner">
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">No authentication required. Returns provider health status.</p>
          <h3>cURL</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>curl https://YOUR_WORKER.workers.dev/v1/health</code></pre>
          </div>
          <h3>Response</h3>
          <div class="code-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
            <pre><code>{
  "status": "healthy",
  "providers": [
    { "name": "OpenAI", "status": "healthy", "models": 5 }
  ]
}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Model ID Format -->
  <div class="docs-section">
    <h2>🏷️ Model ID Format</h2>
    <div class="info-card">
      <p>Models are addressed using the format <code>provider-slug/model-name</code>. The provider slug is the name you gave when adding the provider.</p>
    </div>
    <div class="code-wrapper">
      <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
      <pre><code>openai/gpt-4o
anthropic/claude-3.5-sonnet
google/gemini-2.0-flash
my-provider/llama-3-8b</code></pre>
    </div>
    <div class="info-card">
      <p>Use <a href="/admin/aliases" style="color:var(--accent)">Model Aliases</a> to create short names like <code>gpt-4o</code> that map to full model IDs.</p>
    </div>
  </div>

  <!-- Streaming -->
  <div class="docs-section">
    <h2>⚡ Streaming</h2>
    <div class="info-card">
      <p>Set <code>"stream": true</code> in your request to receive Server-Sent Events (SSE). The response will be streamed chunk by chunk. Works with all three API formats (OpenAI, Anthropic, Gemini).</p>
    </div>
    <h3>Streaming cURL Example</h3>
    <div class="code-wrapper">
      <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
      <pre><code>curl -N -X POST https://YOUR_WORKER.workers.dev/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-api-key-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Write a haiku"}],
    "stream": true
  }'</code></pre>
    </div>
  </div>

  <!-- JavaScript / Python Examples -->
  <div class="docs-section">
    <h2>💻 Quick Examples</h2>

    <h3>JavaScript (fetch)</h3>
    <div class="code-wrapper">
      <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
      <pre><code>const response = await fetch("https://YOUR_WORKER.workers.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-your-api-key-here",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "openai/gpt-4o",
    messages: [{ role: "user", content: "Hello!" }]
  })
});
const data = await response.json();
console.log(data.choices[0].message.content);</code></pre>
    </div>

    <h3>Python (requests)</h3>
    <div class="code-wrapper">
      <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
      <pre><code>import requests

response = requests.post(
    "https://YOUR_WORKER.workers.dev/v1/chat/completions",
    headers={
        "Authorization": "Bearer sk-your-api-key-here",
        "Content-Type": "application/json"
    },
    json={
        "model": "openai/gpt-4o",
        "messages": [{"role": "user", "content": "Hello!"}]
    }
)
data = response.json()
print(data["choices"][0]["message"]["content"])</code></pre>
    </div>

    <h3>OpenAI Python SDK</h3>
    <div class="code-wrapper">
      <button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>
      <pre><code>from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key-here",
    base_url="https://YOUR_WORKER.workers.dev/v1"
)

response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)</code></pre>
    </div>
  </div>

  <script>
  // Set base URL dynamically
  document.getElementById('baseUrl').textContent = window.location.origin;

  // Toggle endpoint body
  function toggleEndpoint(header) {
    const body = header.nextElementSibling;
    body.classList.toggle('open');
  }

  // Copy code to clipboard
  function copyCode(btn) {
    const code = btn.parentElement.querySelector('code');
    navigator.clipboard.writeText(code.textContent).then(() => {
      btn.textContent = '✅ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '📋 Copy';
        btn.classList.remove('copied');
      }, 2000);
    });
  }

  // Copy plain text
  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = event.target;
      btn.textContent = '✅ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '📋 Copy';
        btn.classList.remove('copied');
      }, 2000);
    });
  }
  </script>
  `;

  return new Response(adminLayout("API Docs", "docs", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── Provider Detail Page ────────────────────────────────────────────────

async function renderProviderDetail(id, env, url) {
  const { results: customProviders } = await env.DB.prepare(
    "SELECT * FROM custom_providers WHERE id = ?"
  ).bind(id).all();

  if (!customProviders || customProviders.length === 0) {
    return new Response("Provider not found", { status: 404 });
  }

  const p = customProviders[0];
  const tokens = parseTokens(p.tokens);
  const models = JSON.parse(p.fetched_models || "[]");
  const enabledCount = tokens.filter(t => t.enabled).length;
  const totalCount = tokens.length;

  // Token rows
  const tokenRows = tokens.map((t, i) => `
    <div class="token-row" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border-subtle);${t.enabled ? '' : 'opacity:0.5;'}">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'SF Mono',Consolas,monospace">${t.value}</div>
        ${t.name ? `<div style="font-size:11px;color:var(--text-muted)">${t.name}</div>` : ''}
      </div>
      <form method="POST" action="/admin/providers/toggle-token" style="display:inline">
        <input type="hidden" name="provider_id" value="${p.id}">
        <input type="hidden" name="token_index" value="${i}">
        <label class="toggle toggle-sm">
          <input type="submit" style="display:none">
          <input type="checkbox" ${t.enabled ? 'checked' : ''} onchange="this.form.submit()">
          <span class="slider"></span>
        </label>
      </form>
      <button type="button" class="btn-icon edit" onclick='openTokenModal(${p.id},${i},${JSON.stringify(t.value)},${JSON.stringify(t.name || "")})' title="Edit token">✏️</button>
      <form method="POST" action="/admin/providers/delete-token" onsubmit="return confirm('Remove this token?')" style="display:inline">
        <input type="hidden" name="provider_id" value="${p.id}">
        <input type="hidden" name="token_index" value="${i}">
        <button type="submit" class="btn-icon danger" title="Remove token">✕</button>
      </form>
    </div>
  `).join("");

  // Model rows with full details
  const providerSlugVal = p.slug || providerSlug(p.name);
  const modelRows = Array.isArray(models) && models.length > 0
    ? models.map((m, idx) => {
        const rawId = typeof m === "string" ? m : m.id;
        const fullId = `${providerSlugVal}/${rawId}`;
        const contextWindow = typeof m === "object" ? m.context_window : null;
        const caps = typeof m === "object" ? m.capabilities : {};
        const capBadges = [];
        if (caps.reasoning) capBadges.push('<span class="badge badge-purple" style="font-size:10px">🧠 Reasoning</span>');
        if (caps.vision) capBadges.push('<span class="badge badge-cyan" style="font-size:10px">👁️ Vision</span>');
        return `<div class="model-row" id="model-row-${idx}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border-subtle);transition:var(--transition)">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);font-family:'SF Mono',Consolas,monospace;margin-bottom:4px;word-break:break-all">${fullId}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${contextWindow ? `<span class="badge badge-slate" style="font-size:10px">${(contextWindow/1000).toFixed(0)}k ctx</span>` : ''}
              ${capBadges.join('')}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span id="model-status-${idx}" style="font-size:14px;width:20px;text-align:center"></span>
            <button type="button" class="btn-icon" onclick="copyModelId('${fullId}', this)" title="Copy model ID">📋</button>
            <button type="button" class="btn-icon fetch" onclick="testSingleModel(${p.id}, '${rawId}', ${idx})" title="Test model" id="test-btn-${idx}">▶</button>
          </div>
        </div>`;
      }).join("")
    : '<span style="color:var(--text-muted);font-size:12px;padding:12px 0;display:block;grid-column:1/-1">No models fetched yet. Click "Fetch Models" to discover available models.</span>';

  const content = `
    <div class="page-header">
      <div class="page-header-left">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <a href="/admin/providers" style="color:var(--text-muted);text-decoration:none;display:flex;align-items:center;gap:4px;font-size:13px;transition:var(--transition)" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Providers
          </a>
        </div>
        <h2>${p.name}</h2>
        <p style="font-family:'SF Mono',Consolas,monospace;font-size:12px;color:var(--text-muted);margin-top:4px">${p.base_url}</p>
      </div>
      <div class="page-header-actions">
        <button type="button" class="btn btn-secondary" onclick='openEditProviderModal(${p.id},${JSON.stringify(p.name)},${JSON.stringify(p.slug || providerSlug(p.name))},${JSON.stringify(p.base_url)})'>✏️ Edit</button>
        <form method="POST" action="/admin/providers/delete" onsubmit="return confirm('Delete this provider and all its tokens? This cannot be undone.')" style="display:inline">
          <input type="hidden" name="id" value="${p.id}">
          <button type="submit" class="btn btn-danger">🗑️ Delete</button>
        </form>
        <form method="POST" action="/admin/providers/toggle-custom" style="display:inline">
          <input type="hidden" name="id" value="${p.id}">
          <button type="submit" class="btn ${p.enabled ? 'btn-danger' : 'btn-primary'}">
            ${p.enabled ? '⏸ Disable' : '▶ Enable'}
          </button>
        </form>
      </div>
    </div>

    <!-- Stats -->
    <div class="stat-grid">
      <div class="stat-card ${p.enabled ? 'green' : 'rose'}">
        <div class="label">Status</div>
        <div class="value" style="font-size:22px">${p.enabled ? 'Active' : 'Disabled'}</div>
      </div>
      <div class="stat-card blue">
        <div class="label">Models</div>
        <div class="value">${Array.isArray(models) ? models.length : 0}</div>
      </div>
      <div class="stat-card purple">
        <div class="label">Tokens</div>
        <div class="value">${enabledCount}/${totalCount}</div>
        <div class="sub">${enabledCount} active</div>
      </div>
      <div class="stat-card cyan">
        <div class="label">Provider ID</div>
        <div class="value" style="font-size:18px;font-family:'SF Mono',Consolas,monospace">${p.slug || providerSlug(p.name)}</div>
      </div>
    </div>

    <!-- Tokens Section -->
    <div class="form-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="margin:0;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          API Tokens
        </h3>
        <button type="button" class="btn btn-sm btn-primary" onclick="openAddTokenModal(${p.id})">+ Add Token</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${tokenRows || '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:24px">No tokens configured. Add an API token to start using this provider.</div>'}
      </div>
    </div>

    <!-- Models Section -->
    <div class="form-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="margin:0;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          Available Models
          <span style="font-size:12px;font-weight:500;color:var(--text-muted)">${Array.isArray(models) ? models.length : 0}</span>
        </h3>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn btn-sm btn-secondary" onclick="fetchModelsAjax()" id="fetch-models-btn">↻ Fetch Models</button>
          ${Array.isArray(models) && models.length > 1 ? '<button type="button" class="btn btn-sm btn-primary" onclick="testAllModels()" id="test-all-btn">🧪 Test All</button>' : ''}
        </div>
      </div>
      <div id="models-list" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${modelRows}</div>
      <div id="test-all-progress" style="display:none;margin-top:16px;padding:12px 16px;border-radius:10px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15)"></div>
    </div>

    <!-- Token Selection Strategy -->
    ${totalCount > 1 ? `
    <div class="form-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="margin:0;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
          Token Selection Strategy
        </h3>
      </div>
      <form method="POST" action="/admin/providers/set-token-selection" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <input type="hidden" name="provider_id" value="${p.id}">
        <div style="flex:1;min-width:200px">
          <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px">When multiple tokens are enabled, select the next token using:</label>
          <select name="token_selection" style="width:100%;padding:10px 14px;background:var(--glass-bg);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:13px;cursor:pointer;transition:var(--transition)" onchange="this.form.submit()">
            <option value="round-robin" ${(p.token_selection || 'round-robin') === 'round-robin' ? 'selected' : ''}>🔄 Round Robin — cycle through tokens sequentially</option>
            <option value="random" ${p.token_selection === 'random' ? 'selected' : ''}>🎲 Random — pick a random token each time</option>
            <option value="least-used" ${p.token_selection === 'least-used' ? 'selected' : ''}>📊 Least Used — pick the token with fewest requests</option>
            <option value="sequential" ${p.token_selection === 'sequential' ? 'selected' : ''}>➡️ Sequential — always use the first enabled token</option>
          </select>
        </div>
      </form>
      <div style="margin-top:12px;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:8px;font-size:12px;color:var(--text-secondary);line-height:1.6">
        <strong style="color:var(--accent)">ℹ️ Note:</strong> Round Robin counters reset on worker cold start. For consistent distribution across requests, consider using "Least Used" which tracks usage in the database.
      </div>
    </div>
    ` : ''}

    <!-- Edit Provider Modal -->
    <div id="editProviderModal" class="modal-overlay" onclick="if(event.target===this)this.classList.remove('show')">
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Provider</h3>
          <button onclick="this.closest('.modal-overlay').classList.remove('show')" class="modal-close">&times;</button>
        </div>
        <form method="POST" action="/admin/providers/edit">
          <input type="hidden" id="ep-id" name="id">
          <div class="form-group" style="margin-bottom:16px">
            <label>Provider Name</label>
            <input type="text" id="ep-name" name="name" required>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label>Provider ID (slug)</label>
            <input type="text" id="ep-slug" name="slug" pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only">
            <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block">Used in model IDs: <code id="ep-slug-preview">slug/model-name</code></small>
          </div>
          <div class="form-group" style="margin-bottom:20px">
            <label>Base URL</label>
            <input type="url" id="ep-url" name="base_url" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <button type="button" onclick="this.closest('.modal-overlay').classList.remove('show')" class="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Token Modal -->
    <div id="editTokenModal" class="modal-overlay" onclick="if(event.target===this)this.classList.remove('show')">
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Token</h3>
          <button onclick="this.closest('.modal-overlay').classList.remove('show')" class="modal-close">&times;</button>
        </div>
        <form method="POST" action="/admin/providers/edit-token">
          <input type="hidden" id="et-provider-id" name="provider_id">
          <input type="hidden" id="et-token-index" name="token_index">
          <div class="form-group" style="margin-bottom:16px">
            <label>Token Value</label>
            <input type="text" id="et-token-value" name="token_value" required style="font-family:'SF Mono',Consolas,monospace;font-size:12px">
          </div>
          <div class="form-group" style="margin-bottom:20px">
            <label>Name (optional)</label>
            <input type="text" id="et-token-name" name="token_name" placeholder="e.g. Production key">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Token</button>
            <button type="button" onclick="this.closest('.modal-overlay').classList.remove('show')" class="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Token Modal -->
    <div id="addTokenModal" class="modal-overlay" onclick="if(event.target===this)this.classList.remove('show')">
      <div class="modal">
        <div class="modal-header">
          <h3>Add Token</h3>
          <button onclick="this.closest('.modal-overlay').classList.remove('show')" class="modal-close">&times;</button>
        </div>
        <form method="POST" action="/admin/providers/add-token">
          <input type="hidden" id="at-provider-id" name="provider_id">
          <div class="form-group" style="margin-bottom:16px">
            <label>Token Value</label>
            <input type="text" name="token_value" required placeholder="sk-..." style="font-family:'SF Mono',Consolas,monospace;font-size:12px">
          </div>
          <div class="form-group" style="margin-bottom:20px">
            <label>Name (optional)</label>
            <input type="text" name="token_name" placeholder="e.g. Production key">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Add Token</button>
            <button type="button" onclick="this.closest('.modal-overlay').classList.remove('show')" class="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <style>
      .modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:200;align-items:center;justify-content:center}
      .modal-overlay.show{display:flex}
      .modal{background:var(--bg-secondary);backdrop-filter:blur(24px);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:500px;box-shadow:0 25px 60px rgba(0,0,0,0.5)}
      .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
      .modal-header h3{margin:0;font-size:16px;font-weight:700;color:var(--text-primary)}
      .modal-close{background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0;line-height:1;transition:var(--transition)}
      .modal-close:hover{color:var(--text-primary)}
      @keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes dotPulse{0%,80%,100%{opacity:0.3}40%{opacity:1}}
      @keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
      @keyframes toastOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(40px)}}
      .fetch-spinner{display:inline-block;width:14px;height:14px;border:2px solid var(--border-subtle);border-top-color:var(--accent-blue);border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle}
      .test-dot-pulse{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent-blue);animation:dotPulse 1.4s infinite ease-in-out;margin-right:4px;vertical-align:middle}
      @media(max-width:1100px){#models-list{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:700px){#models-list{grid-template-columns:1fr}}
    </style>

    <script>
    const PROVIDER_ID = ${p.id};
    const PROVIDER_URL = '${encodeURIComponent(p.base_url)}';
    const PROVIDER_SLUG = '${providerSlugVal}';

    function openEditProviderModal(id, name, slug, url) {
      document.getElementById('ep-id').value = id;
      document.getElementById('ep-name').value = name;
      document.getElementById('ep-slug').value = slug || '';
      document.getElementById('ep-slug-preview').textContent = (slug || 'provider') + '/model-name';
      document.getElementById('ep-url').value = url;
      document.getElementById('editProviderModal').classList.add('show');
    }
    document.getElementById('ep-name').addEventListener('input', function() {
      const slug = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 32) || 'provider';
      document.getElementById('ep-slug-preview').textContent = slug + '/model-name';
      const slugInput = document.getElementById('ep-slug');
      if (!slugInput.dataset.touched) slugInput.value = slug;
    });
    document.getElementById('ep-slug').addEventListener('input', function() {
      this.dataset.touched = 'true';
    });
    function openTokenModal(providerId, tokenIndex, tokenValue, tokenName) {
      document.getElementById('et-provider-id').value = providerId;
      document.getElementById('et-token-index').value = tokenIndex;
      document.getElementById('et-token-value').value = tokenValue;
      document.getElementById('et-token-name').value = tokenName;
      document.getElementById('editTokenModal').classList.add('show');
    }
    function openAddTokenModal(providerId) {
      document.getElementById('at-provider-id').value = providerId;
      document.getElementById('addTokenModal').classList.add('show');
    }

    // ── Copy Model ID ──
    function copyModelId(id, btn) {
      navigator.clipboard.writeText(id).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = orig, 1500);
      });
    }

    // ── Fetch Models (AJAX) ──
    async function fetchModelsAjax() {
      const btn = document.getElementById('fetch-models-btn');
      const list = document.getElementById('models-list');
      btn.disabled = true;
      btn.innerHTML = '<span class="fetch-spinner"></span> Fetching...';
      btn.style.opacity = '0.6';
      list.innerHTML = '<div style="padding:16px;text-align:center"><div class="fetch-spinner" style="margin:0 auto"></div><div style="color:var(--text-muted);font-size:12px;margin-top:8px">Fetching models from provider...</div></div>';
      try {
        const resp = await fetch('/admin/providers/fetch-models', {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: 'url=' + PROVIDER_URL + '&type=custom&id=' + PROVIDER_ID
        });
        const data = await resp.json();
        if (resp.ok && data.models && data.models.length > 0) {
          window.location.reload();
        } else {
          list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--accent-rose);font-size:12px">' + (data.error || 'No models found') + '</div>';
          btn.disabled = false;
          btn.innerHTML = '↻ Fetch Models';
          btn.style.opacity = '1';
        }
      } catch (e) {
        list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--accent-rose);font-size:12px">Error: ' + e.message + '</div>';
        btn.disabled = false;
        btn.innerHTML = '↻ Fetch Models';
        btn.style.opacity = '1';
      }
    }

    // ── Toast Helper ──
    function showToast(message, type) {
      const existing = document.getElementById('test-toast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.id = 'test-toast';
      toast.style.cssText = 'position:fixed;top:24px;right:24px;z-index:999;padding:14px 20px;border-radius:12px;font-size:13px;font-weight:500;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:toastIn 0.3s ease;max-width:400px;word-break:break-word;backdrop-filter:blur(12px)';
      if (type === 'success') {
        toast.style.background = 'rgba(16,185,129,0.9)';
        toast.innerHTML = '✅ ' + message;
      } else {
        toast.style.background = 'rgba(244,63,94,0.9)';
        toast.innerHTML = '❌ ' + message;
      }
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
    }

    // ── Test Single Model ──
    async function testSingleModel(providerId, modelId, idx) {
      const btn = document.getElementById('test-btn-' + idx);
      const status = document.getElementById('model-status-' + idx);
      const row = document.getElementById('model-row-' + idx);
      btn.disabled = true;
      btn.innerHTML = '⏳';
      if (status) status.innerHTML = '';
      if (row) { row.style.borderColor = 'rgba(59,130,246,0.3)'; }
      try {
        const resp = await fetch('/admin/providers/test-model', {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: 'provider_id=' + providerId + '&model_id=' + encodeURIComponent(modelId)
        });
        const data = await resp.json();
        if (data.ok) {
          if (row) { row.style.borderColor = 'rgba(16,185,129,0.3)'; row.style.background = 'rgba(16,185,129,0.04)'; }
          if (status) status.innerHTML = '✅';
          btn.innerHTML = '✅';
          showToast(modelId + ' is working — ' + data.reply.substring(0, 60), 'success');
        } else {
          if (row) { row.style.borderColor = 'rgba(244,63,94,0.3)'; row.style.background = 'rgba(244,63,94,0.04)'; }
          if (status) status.innerHTML = '❌';
          btn.innerHTML = '❌';
          showToast(modelId + ' failed — ' + (data.error || 'Unknown error').substring(0, 60), 'error');
        }
      } catch (e) {
        if (row) { row.style.borderColor = 'rgba(244,63,94,0.3)'; }
        if (status) status.innerHTML = '❌';
        btn.innerHTML = '❌';
        showToast(modelId + ' error — ' + e.message, 'error');
      }
      btn.disabled = false;
      setTimeout(() => { btn.innerHTML = '▶'; }, 2000);
    }

    // ── Test All Models (Sequential) ──
    async function testAllModels() {
      const testAllBtn = document.getElementById('test-all-btn');
      const progressDiv = document.getElementById('test-all-progress');
      const modelRows = document.querySelectorAll('.model-row');
      if (!modelRows.length) return;

      testAllBtn.disabled = true;
      testAllBtn.innerHTML = '⏳ Testing...';
      progressDiv.style.display = 'block';
      progressDiv.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary)"><div class="fetch-spinner"></div><span id="test-all-status">Preparing tests...</span></div>';

      // Collect model IDs from the rows
      const modelElements = [];
      modelRows.forEach((row, i) => {
        const idEl = row.querySelector('[style*="font-family"]');
        if (idEl) {
          const fullId = idEl.textContent.trim();
          const rawId = fullId.replace(PROVIDER_SLUG + '/', '');
          modelElements.push({ rawId, fullId, idx: i });
        }
      });

      let passed = 0, failed = 0;

      for (let i = 0; i < modelElements.length; i++) {
        const m = modelElements[i];
        const statusEl = document.getElementById('test-all-status');
        statusEl.textContent = 'Testing ' + (i+1) + '/' + modelElements.length + ': ' + m.rawId;

        // Highlight current row
        const row = document.getElementById('model-row-' + m.idx);
        if (row) { row.style.borderColor = 'rgba(59,130,246,0.4)'; row.style.background = 'rgba(59,130,246,0.06)'; }

        try {
          const resp = await fetch('/admin/providers/test-model', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: 'provider_id=' + PROVIDER_ID + '&model_id=' + encodeURIComponent(m.rawId)
          });
          const data = await resp.json();
          if (data.ok) {
            passed++;
            if (row) { row.style.borderColor = 'rgba(16,185,129,0.3)'; row.style.background = 'rgba(16,185,129,0.04)'; }
            const btn = document.getElementById('test-btn-' + m.idx);
            if (btn) btn.innerHTML = '✅';
            const status = document.getElementById('model-status-' + m.idx);
            if (status) status.innerHTML = '✅';
          } else {
            failed++;
            if (row) { row.style.borderColor = 'rgba(244,63,94,0.3)'; row.style.background = 'rgba(244,63,94,0.04)'; }
            const btn = document.getElementById('test-btn-' + m.idx);
            if (btn) btn.innerHTML = '❌';
            const status = document.getElementById('model-status-' + m.idx);
            if (status) status.innerHTML = '❌';
          }
        } catch (e) {
          failed++;
          if (row) { row.style.borderColor = 'rgba(244,63,94,0.3)'; }
          const btn = document.getElementById('test-btn-' + m.idx);
          if (btn) btn.innerHTML = '❌';
          const status = document.getElementById('model-status-' + m.idx);
          if (status) status.innerHTML = '❌';
        }
        // Small delay between tests
        await new Promise(r => setTimeout(r, 300));
      }

      // Final summary toast
      const statusEl = document.getElementById('test-all-status');
      statusEl.innerHTML = '<span style="color:var(--accent-green)">' + passed + ' passed</span> · <span style="color:' + (failed > 0 ? 'var(--accent-rose)' : 'var(--text-muted)') + '">' + failed + ' failed</span> · ' + modelElements.length + ' total';
      testAllBtn.disabled = false;
      testAllBtn.innerHTML = '🧪 Test All';
      showToast(passed + '/' + modelElements.length + ' models working' + (failed > 0 ? ' (' + failed + ' failed)' : ''), failed > 0 ? 'error' : 'success');
    }

    // Auto-fetch models if none are loaded yet
    (function() {
      const list = document.getElementById('models-list');
      const hasNoModels = list && list.textContent.includes('No models fetched yet');
      if (hasNoModels && ${p.enabled ? 'true' : 'false'}) {
        fetchModelsAjax();
      }
    })();
    </script>
  `;

  return new Response(adminLayout(p.name + " - Provider", "providers", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── API Documentation Page ──────────────────────────────────────────────

const docsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CFRouter API Docs</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0b1020;color:#fff;font-family:Inter,Arial,sans-serif;line-height:1.6}
.container{width:100%;max-width:1100px;margin:auto;padding:40px 20px}
.hero{margin-bottom:40px}
.hero h1{font-size:36px;margin-bottom:8px}
.hero p{color:#a0a7c0;font-size:16px}
.base-url{background:#11182d;border:1px solid #1f2940;padding:14px 16px;border-radius:10px;margin-top:16px;font-family:monospace;font-size:14px}
.auth-box{background:#2b1d12;border:1px solid #5c3b1e;padding:16px;border-radius:10px;margin-top:16px}
.auth-box h3{font-size:14px;margin-bottom:6px}
.auth-box p{color:#a0a7c0;font-size:13px}
.section{margin-top:48px}
.section-title{font-size:24px;margin-bottom:16px}
.endpoint{background:#11182d;border:1px solid #1f2940;border-radius:12px;overflow:hidden;margin-bottom:24px}
.endpoint-header{padding:16px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #1f2940}
.method{padding:4px 10px;border-radius:6px;font-weight:bold;font-size:12px}
.get{background:#1f6feb}.post{background:#238636}
.path{font-family:monospace;font-size:16px}
.endpoint-body{padding:20px}
.endpoint-body p{color:#a0a7c0;font-size:14px}
pre{background:#0d1425;padding:16px;border-radius:8px;overflow:auto;margin-top:12px;border:1px solid #1d2740;font-size:13px}
code{color:#8bd5ff}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #1f2940;padding:10px 14px;text-align:left;font-size:13px}
th{background:#151f38}
.model-card{background:#11182d;border:1px solid #1f2940;border-radius:10px;padding:16px;margin-bottom:12px}
.model-name{font-size:18px;font-weight:600;margin-bottom:4px}
.badge{display:inline-block;background:#1d2a4a;padding:4px 8px;border-radius:6px;margin-right:6px;margin-top:6px;font-size:12px}
.copy-btn{margin-top:8px;background:#2563eb;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px}
.copy-btn:hover{opacity:0.9}
.footer{margin-top:60px;color:#7d859f;text-align:center;font-size:13px}
h3{font-size:15px;margin-top:20px}
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    <h1>CFRouter API</h1>
    <p>OpenAI-compatible AI Gateway with round-robin load balancing</p>
    <div class="base-url">Base URL: <strong>https://your-worker.workers.dev</strong></div>
    <div class="auth-box">
      <h3>Authentication</h3>
      <p>Include your API key in the Authorization header:</p>
      <pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Models</h2>
    <p style="color:#a0a7c0;margin-bottom:16px">Models are determined by your configured providers. Use the model ID format: <code>provider-slug/model-name</code></p>
    <div class="model-card">
      <div class="model-name">openai/gpt-4o</div>
      <div style="color:#a0a7c0">Example: OpenAI GPT-4o</div>
      <span class="badge">Vision</span><span class="badge">128k context</span>
    </div>
    <div class="model-card">
      <div class="model-name">anthropic/claude-3.5-sonnet</div>
      <div style="color:#a0a7c0">Example: Anthropic Claude 3.5 Sonnet</div>
      <span class="badge">Vision</span><span class="badge">200k context</span>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Endpoints</h2>

    <div class="endpoint">
      <div class="endpoint-header">
        <div class="method get">GET</div>
        <div class="path">/v1/models</div>
      </div>
      <div class="endpoint-body">
        <p>Returns all available models in OpenAI-compatible format.</p>
        <h3>Example</h3>
<pre><code>curl https://your-worker.workers.dev/v1/models</code></pre>
        <h3>Response</h3>
<pre><code>{
  "object": "list",
  "data": [
    { "id": "openai/gpt-4o", "object": "model", "owned_by": "openai" },
    { "id": "my-provider/llama-3-8b", "object": "model", "owned_by": "my-provider" }
  ]
}</code></pre>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <div class="method post">POST</div>
        <div class="path">/v1/chat/completions</div>
      </div>
      <div class="endpoint-body">
        <p>Generate chat completions. OpenAI-compatible format for agent integration.</p>
        <h3>Headers</h3>
        <table>
          <tr><th>Header</th><th>Value</th></tr>
          <tr><td>Authorization</td><td>Bearer YOUR_API_KEY</td></tr>
          <tr><td>Content-Type</td><td>application/json</td></tr>
        </table>
        <h3>Request Body</h3>
<pre><code>{
  "model": "openai/gpt-4o",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 2048,
  "stream": false
}</code></pre>
        <h3>cURL</h3>
<pre><code id="chat-curl">curl -X POST https://your-worker.workers.dev/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openai/gpt-4o","messages":[{"role":"user","content":"Hello!"}],"stream":false}'</code></pre>
<button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('chat-curl').innerText);this.textContent='Copied!'">Copy</button>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <div class="method post">POST</div>
        <div class="path">/v1/embeddings</div>
      </div>
      <div class="endpoint-body">
        <p>Generate vector embeddings for semantic search and RAG systems.</p>
        <h3>Request Body</h3>
<pre><code>{
  "model": "text-embedding-small",
  "input": ["Hello world", "Testing embeddings"]
}</code></pre>
      </div>
    </div>

    <!-- Anthropic Messages API -->
    <div class="endpoint">
      <div class="endpoint-header">
        <div class="method post">POST</div>
        <div class="path">/v1/messages</div>
      </div>
      <div class="endpoint-body">
        <p>Anthropic Messages API compatible endpoint. Converts to OpenAI format internally.</p>
        <h3>Request Body</h3>
<pre><code>{
  "model": "anthropic/claude-3.5-sonnet",
  "max_tokens": 1024,
  "system": "You are a helpful assistant.",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false
}</code></pre>
        <h3>cURL</h3>
<pre><code id="anthropic-curl">curl -X POST https://your-worker.workers.dev/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"anthropic/claude-3.5-sonnet","max_tokens":1024,"messages":[{"role":"user","content":"Hello!"}]}'</code></pre>
<button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('anthropic-curl').innerText);this.textContent='Copied!'">Copy</button>
      </div>
    </div>

    <!-- Gemini API -->
    <div class="endpoint">
      <div class="endpoint-header">
        <div class="method post">POST</div>
        <div class="path">/v1beta/models/{model}:generateContent</div>
      </div>
      <div class="endpoint-body">
        <p>Google Gemini API compatible endpoint. Converts to OpenAI format internally.</p>
        <h3>Request Body</h3>
<pre><code>{
  "contents": [
    { "role": "user", "parts": [{ "text": "Hello!" }] }
  ],
  "systemInstruction": {
    "parts": [{ "text": "You are a helpful assistant." }]
  },
  "generationConfig": {
    "maxOutputTokens": 1024,
    "temperature": 0.7
  }
}</code></pre>
        <h3>cURL</h3>
<pre><code id="gemini-curl">curl -X POST https://your-worker.workers.dev/v1beta/models/gemini-pro:generateContent \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"contents":[{"role":"user","parts":[{"text":"Hello!"}]}]}'</code></pre>
<button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('gemini-curl').innerText);this.textContent='Copied!'">Copy</button>
      </div>
    </div>
  </div>

  <div class="footer">CFRouter Gateway &middot; Powered by Cloudflare Workers</div>
</div>
</body>
</html>`;
