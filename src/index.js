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

// ─── Provider Catalog ──────────────────────────────────────────────────
// Pre-built catalog of popular AI providers for quick setup.
// Users click a provider, get auto-filled fields, paste their API key, done.
const PROVIDER_CATALOG = [
  // ── Frontier Labs ──
  { id: "openai", name: "OpenAI", slug: "openai", baseUrl: "https://api.openai.com/v1", description: "GPT-4o, GPT-4.1, o3, DALL·E, Whisper, Codex", website: "https://platform.openai.com", color: "#10a37f", category: "frontier", hasFree: false, letter: "O" },
  { id: "anthropic", name: "Anthropic", slug: "anthropic", baseUrl: "https://api.anthropic.com/v1", description: "Claude 4 Opus, Sonnet, Haiku, Claude Code", website: "https://console.anthropic.com", color: "#d4a574", category: "frontier", hasFree: false, letter: "A" },
  { id: "gemini", name: "Google Gemini", slug: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", description: "Gemini 2.5 Pro/Flash, Imagen, Veo", website: "https://aistudio.google.com", color: "#4285f4", category: "frontier", hasFree: true, letter: "G" },
  { id: "groq", name: "Groq", slug: "groq", baseUrl: "https://api.groq.com/openai/v1", description: "Ultra-fast Llama, Mixtral, Gemma on LPU", website: "https://console.groq.com", color: "#f55036", category: "frontier", hasFree: true, letter: "Gr" },
  { id: "xai", name: "xAI (Grok)", slug: "xai", baseUrl: "https://api.x.ai/v1", description: "Grok 3, Grok 3 Mini — real-time X data", website: "https://console.x.ai", color: "#1d9bf0", category: "frontier", hasFree: false, letter: "x" },
  { id: "mistral", name: "Mistral AI", slug: "mistral", baseUrl: "https://api.mistral.ai/v1", description: "Mistral Large, Medium, Small, Codestral", website: "https://console.mistral.ai", color: "#f76e11", category: "frontier", hasFree: true, letter: "M" },
  { id: "perplexity", name: "Perplexity", slug: "perplexity", baseUrl: "https://api.perplexity.ai", description: "Sonar models with real-time web search", website: "https://perplexity.ai", color: "#20b8cd", category: "frontier", hasFree: false, letter: "P" },
  { id: "cohere", name: "Cohere", slug: "cohere", baseUrl: "https://api.cohere.com/v2", description: "Command R+, Embed, Rerank", website: "https://dashboard.cohere.com", color: "#39594d", category: "frontier", hasFree: true, letter: "C" },
  { id: "meta-llama", name: "Meta Llama", slug: "meta-llama", baseUrl: "https://llama.developer.meta.com/v1", description: "Llama 4 Maverick/Scout, open-source LLMs", website: "https://llama.developer.meta.com", color: "#0668e1", category: "frontier", hasFree: false, letter: "L" },
  { id: "deepseek", name: "DeepSeek", slug: "deepseek", baseUrl: "https://api.deepseek.com/v1", description: "DeepSeek-V3, R1 — powerful & affordable", website: "https://platform.deepseek.com", color: "#4d6bfe", category: "frontier", hasFree: true, letter: "DS" },
  { id: "ai21", name: "AI21 Labs", slug: "ai21", baseUrl: "https://api.ai21.com/studio/v1", description: "Jamba, Samba models — long context", website: "https://www.ai21.com", color: "#e8433e", category: "frontier", hasFree: true, letter: "A21" },
  { id: "venice", name: "Venice.ai", slug: "venice", baseUrl: "https://api.venice.ai/api/v1", description: "Private AI — uncensored, no logs", website: "https://venice.ai", color: "#7c3aed", category: "frontier", hasFree: false, letter: "V" },
  { id: "nous-research", name: "Nous Research", slug: "nous-research", baseUrl: "https://api.nousresearch.com/v1", description: "Hermes, Meta-Llama fine-tunes", website: "https://portal.nousresearch.com", color: "#8b5cf6", category: "frontier", hasFree: true, letter: "NR" },
  { id: "reka", name: "Reka AI", slug: "reka", baseUrl: "https://api.reka.ai/v1", description: "Reka Core/Flash — multimodal models", website: "https://platform.reka.ai", color: "#0ea5e9", category: "frontier", hasFree: true, letter: "Rk" },

  // ── Inference Hosts ──
  { id: "together", name: "Together AI", slug: "together", baseUrl: "https://api.together.xyz/v1", description: "Open-source models, fine-tuning, inference", website: "https://api.together.xyz/settings/api-keys", color: "#6366f1", category: "inference", hasFree: false, letter: "T" },
  { id: "fireworks", name: "Fireworks AI", slug: "fireworks", baseUrl: "https://api.fireworks.ai/inference/v1", description: "Fast open-source model serving", website: "https://fireworks.ai", color: "#ff6b35", category: "inference", hasFree: false, letter: "F" },
  { id: "cerebras", name: "Cerebras", slug: "cerebras", baseUrl: "https://api.cerebras.ai/v1", description: "Wafer-scale chip — fastest inference", website: "https://cloud.cerebras.ai", color: "#00c2a1", category: "inference", hasFree: false, letter: "Cb" },
  { id: "nvidia", name: "NVIDIA NIM", slug: "nvidia", baseUrl: "https://integrate.api.nvidia.com/v1", description: "GPU-optimized models, 40+ free models", website: "https://build.nvidia.com", color: "#76b900", category: "inference", hasFree: true, letter: "NV" },
  { id: "huggingface", name: "Hugging Face", slug: "huggingface", baseUrl: "https://api-inference.huggingface.co/v1", description: "Open models hub — free inference API", website: "https://huggingface.co/settings/tokens", color: "#ffd21e", category: "inference", hasFree: true, letter: "HF" },
  { id: "sambanova", name: "SambaNova", slug: "sambanova", baseUrl: "https://api.sambanova.ai/v1", description: "Fast inference — Llama, DeepSeek", website: "https://cloud.sambanova.ai/apis", color: "#ef4444", category: "inference", hasFree: false, letter: "SN" },
  { id: "siliconflow", name: "SiliconFlow", slug: "siliconflow", baseUrl: "https://api.siliconflow.cn/v1", description: "Open-source models — DeepSeek, Qwen", website: "https://cloud.siliconflow.com", color: "#3b82f6", category: "inference", hasFree: false, letter: "SF" },
  { id: "hyperbolic", name: "Hyperbolic", slug: "hyperbolic", baseUrl: "https://api.hyperbolic.xyz/v1", description: "Open AI marketplace — fair pricing", website: "https://app.hyperbolic.xyz", color: "#a855f7", category: "inference", hasFree: false, letter: "Hb" },
  { id: "deepinfra", name: "DeepInfra", slug: "deepinfra", baseUrl: "https://api.deepinfra.com/v1/openai", description: "Low-cost inference for open models", website: "https://deepinfra.com/dash/api_keys", color: "#1e40af", category: "inference", hasFree: false, letter: "DI" },
  { id: "lambda", name: "Lambda", slug: "lambda", baseUrl: "https://api.lambdatest.com/v1", description: "GPU cloud — Llama, Mistral inference", website: "https://cloud.lambdatest.com", color: "#6366f1", category: "inference", hasFree: false, letter: "Lb" },
  { id: "nebius", name: "Nebius", slug: "nebius", baseUrl: "https://api.studio.nebius.com/v1", description: "Open models on NVIDIA H100s", website: "https://nebius.com", color: "#06b6d4", category: "inference", hasFree: false, letter: "Nb" },
  { id: "baseten", name: "Baseten", slug: "baseten", baseUrl: "https://api.baseten.co/v1", description: "Model inference — truss framework", website: "https://app.baseten.co/settings/api-keys", color: "#7c3aed", category: "inference", hasFree: false, letter: "Bt" },
  { id: "friendli", name: "FriendliAI", slug: "friendli", baseUrl: "https://inference.friendli.ai/v1", description: "Fast inference — LoRA serving", website: "https://app.friendli.ai", color: "#06b6d4", category: "inference", hasFree: true, letter: "Fl" },
  { id: "upstage", name: "Upstage", slug: "upstage", baseUrl: "https://api.upstage.ai/v1/solar", description: "Solar models — compact & efficient", website: "https://app.upstage.ai", color: "#3b82f6", category: "inference", hasFree: false, letter: "Up" },

  // ── Aggregators / Gateways ──
  { id: "openrouter", name: "OpenRouter", slug: "openrouter", baseUrl: "https://openrouter.ai/api/v1", description: "150+ models, 20 free models (20 RPM)", website: "https://openrouter.ai/keys", color: "#6366f1", category: "gateway", hasFree: true, letter: "OR" },
  { id: "requesty", name: "Requesty", slug: "requesty", baseUrl: "https://api.requesty.ai/v1", description: "LLM routing — ~200 free req/day", website: "https://app.requesty.ai", color: "#10b981", category: "gateway", hasFree: true, letter: "Rq" },
  { id: "novita", name: "Novita AI", slug: "novita", baseUrl: "https://api.novita.ai/v3/openai", description: "Open models — $0.50 free trial", website: "https://novita.ai", color: "#f59e0b", category: "gateway", hasFree: true, letter: "Nv" },
  { id: "poe", name: "Poe", slug: "poe", baseUrl: "https://api.poe.com/v1", description: "Multi-model gateway — GPT, Claude, Llama", website: "https://poe.com", color: "#3b82f6", category: "gateway", hasFree: false, letter: "Pe" },
  { id: "chutes", name: "Chutes AI", slug: "chutes", baseUrl: "https://api.chutes.ai/v1", description: "Open models — pay-per-token", website: "https://chutes.ai", color: "#f43f5e", category: "gateway", hasFree: false, letter: "Ch" },
  { id: "aimlapi", name: "AIML API", slug: "aimlapi", baseUrl: "https://api.aimlapi.ai/v1", description: "100+ models, unified API", website: "https://aimlapi.com", color: "#8b5cf6", category: "gateway", hasFree: false, letter: "AM" },
  { id: "zylo-api", name: "ZYLO API", slug: "zylo-api", baseUrl: "https://api.zyloai.net/v1", description: "Free tier: 10 RPM / 7200 req/day", website: "https://zyloai.net", color: "#06b6d4", category: "gateway", hasFree: true, letter: "ZL" },
  { id: "anyapi", name: "AnyAPI", slug: "anyapi", baseUrl: "https://anyapi.ai/v1", description: "100K ANY tokens/day free", website: "https://anyapi.ai", color: "#10b981", category: "gateway", hasFree: true, letter: "An" },
  { id: "fastrouter", name: "FastRouter", slug: "fastrouter", baseUrl: "https://api.fastrouter.ai/v1", description: "Fast LLM routing & load balancing", website: "https://fastrouter.ai", color: "#ef4444", category: "gateway", hasFree: true, letter: "FR" },
  { id: "llmgateway", name: "LLM Gateway", slug: "llmgateway", baseUrl: "https://api.llmgateway.io/v1", description: "Multi-provider gateway", website: "https://llmgateway.io", color: "#6366f1", category: "gateway", hasFree: true, letter: "LG" },
  { id: "llm-kiwi", name: "LLM Kiwi", slug: "llm-kiwi", baseUrl: "https://api.llm.kiwi/v1", description: "Open models gateway", website: "https://llm.kiwi", color: "#84cc16", category: "gateway", hasFree: true, letter: "LK" },
  { id: "literouter", name: "LiteRouter", slug: "literouter", baseUrl: "https://api.literouter.com/v1", description: "Lightweight model routing", website: "https://literouter.com", color: "#f59e0b", category: "gateway", hasFree: true, letter: "LR" },
  { id: "mixlayer", name: "MixLayer", slug: "mixlayer", baseUrl: "https://models.mixlayer.ai/v1", description: "Multi-model access", website: "https://mixlayer.ai", color: "#ec4899", category: "gateway", hasFree: true, letter: "ML" },
  { id: "speka", name: "Speka", slug: "speka", baseUrl: "https://api.speka.me/v1", description: "Budget-friendly model access", website: "https://speka.me", color: "#8b5cf6", category: "gateway", hasFree: true, letter: "Sp" },
  { id: "tokenreply", name: "TokenReply", slug: "tokenreply", baseUrl: "https://api.tokenreply.com/v1", description: "Model token relay", website: "https://tokenreply.com", color: "#06b6d4", category: "gateway", hasFree: true, letter: "TR" },
  { id: "nanogpt", name: "NanoGPT", slug: "nanogpt", baseUrl: "https://nano-gpt.com/api/v1", description: "Simple model gateway", website: "https://nano-gpt.com", color: "#10b981", category: "gateway", hasFree: false, letter: "NG" },
  { id: "openadapter", name: "OpenAdapter", slug: "openadapter", baseUrl: "https://api.openadapter.in/v1", description: "Open model adapter", website: "https://openadapter.in", color: "#f59e0b", category: "gateway", hasFree: true, letter: "OA" },
  { id: "navy", name: "Navy AI", slug: "navy", baseUrl: "https://api.navy/v1", description: "Shared 150K tokens/day free pool", website: "https://navy.ai", color: "#1e40af", category: "gateway", hasFree: true, letter: "Nv" },
  { id: "ainative", name: "AI Native", slug: "ainative", baseUrl: "https://api.ainative.studio/api/v1", description: "~10M tokens/month free", website: "https://ainative.studio", color: "#10b981", category: "gateway", hasFree: true, letter: "AN" },
  { id: "seekai", name: "SeekAI", slug: "seekai", baseUrl: "https://seekai.cc/v1", description: "Open models gateway", website: "https://seekai.cc", color: "#6366f1", category: "gateway", hasFree: true, letter: "SA" },

  // ── Regional / China ──
  { id: "alibaba", name: "Alibaba Bailian", slug: "alibaba", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", description: "Qwen models, Tongyi platform", website: "https://bailian.console.alibabacloud.com", color: "#ff6a00", category: "regional", hasFree: false, letter: "AB" },
  { id: "qwen-cloud", name: "Qwen Cloud", slug: "qwen-cloud", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", description: "Qwen 3 — Alibaba cloud inference", website: "https://dashscope.console.aliyun.com", color: "#6200ea", category: "regional", hasFree: false, letter: "QW" },
  { id: "kimi", name: "Kimi (Moonshot)", slug: "kimi", baseUrl: "https://api.moonshot.cn/v1", description: "Kimi K2 — 128K context", website: "https://platform.moonshot.cn", color: "#000000", category: "regional", hasFree: false, letter: "Ki" },
  { id: "minimax", name: "MiniMax", slug: "minimax", baseUrl: "https://api.minimax.chat/v1", description: "MiniMax-Text, abab models", website: "https://platform.minimaxi.com", color: "#3b82f6", category: "regional", hasFree: false, letter: "MM" },
  { id: "volcengine", name: "ByteDance Volcengine", slug: "volcengine", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", description: "Doubao models — ByteDance AI", website: "https://console.volcengine.com/ark", color: "#ff2d55", category: "regional", hasFree: false, letter: "VD" },
  { id: "baidu", name: "Baidu ERNIE", slug: "baidu", baseUrl: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop", description: "ERNIE 4.5, Speed, Lite", website: "https://console.bce.baidu.com", color: "#2932e1", category: "regional", hasFree: true, letter: "BD" },
  { id: "tencent", name: "Tencent Hunyuan", slug: "tencent", baseUrl: "https://api.lkeap.cloud.tencent.com/v1", description: "Hunyuan Lite — free tier", website: "https://console.cloud.tencent.com", color: "#006eff", category: "regional", hasFree: true, letter: "TX" },
  { id: "stepfun", name: "StepFun", slug: "stepfun", baseUrl: "https://api.stepfun.com/v1", description: "Step 2 — Chinese LLM platform", website: "https://platform.stepfun.ai", color: "#6366f1", category: "regional", hasFree: true, letter: "SF" },
  { id: "agnes", name: "Agnes AI", slug: "agnes", baseUrl: "https://api.agnes-ai.com/v1", description: "Permanently free models", website: "https://agnes-ai.com", color: "#10b981", category: "regional", hasFree: true, letter: "Ag" },
  { id: "360ai", name: "360 AI", slug: "360ai", baseUrl: "https://api.360.cn/v1", description: "360 LLM — Chinese tech giant", website: "https://ai.360.cn", color: "#00bfff", category: "regional", hasFree: true, letter: "36" },
  { id: "doubao", name: "Doubao (ByteDance)", slug: "doubao", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", description: "Doubao Pro — ByteDance consumer AI", website: "https://www.doubao.com", color: "#ff6b35", category: "regional", hasFree: false, letter: "Db" },
  { id: "baichuan", name: "Baichuan", slug: "baichuan", baseUrl: "https://api.baichuan-ai.com/v1", description: "Baichuan 4 — Chinese LLM", website: "https://platform.baichuan-ai.com", color: "#3b82f6", category: "regional", hasFree: true, letter: "BC" },
  { id: "yi", name: "Yi (01.AI)", slug: "yi", baseUrl: "https://api.lingyiwanwu.com/v1", description: "Yi-Lightning — fast Chinese LLM", website: "https://platform.lingyiwanwu.com", color: "#6366f1", category: "regional", hasFree: false, letter: "Yi" },
  { id: "sensenova", name: "SenseNova", slug: "sensenova", baseUrl: "https://api.sensenova.cn/v1", description: "SenseChat — SenseTime AI", website: "https://platform.sensenova.cn", color: "#00bfff", category: "regional", hasFree: false, letter: "SN" },

  // ── Enterprise Cloud ──
  { id: "azure-openai", name: "Azure OpenAI", slug: "azure-openai", baseUrl: "https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT", description: "Enterprise GPT-4o, DALL·E, Whisper", website: "https://portal.azure.com", color: "#0078d4", category: "enterprise", hasFree: false, letter: "Az" },
  { id: "bedrock", name: "AWS Bedrock", slug: "bedrock", baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com", description: "Claude, Llama, Mistral on AWS", website: "https://console.aws.amazon.com/bedrock", color: "#ff9900", category: "enterprise", hasFree: false, letter: "BR" },
  { id: "vertex", name: "Google Vertex AI", slug: "vertex", baseUrl: "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT", description: "Gemini, PaLM on Google Cloud", website: "https://console.cloud.google.com/vertex-ai", color: "#4285f4", category: "enterprise", hasFree: false, letter: "VA" },
  { id: "cloudflare-ai", name: "Cloudflare AI", slug: "cloudflare-ai", baseUrl: "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT/ai/run", description: "Workers AI — 10K Neurons/day free", website: "https://dash.cloudflare.com", color: "#f48120", category: "enterprise", hasFree: true, letter: "CF" },
  { id: "scaleway", name: "Scaleway", slug: "scaleway", baseUrl: "https://api.scaleway.ai/v1", description: "1M free tokens — Paris edge", website: "https://console.scaleway.com", color: "#0055d6", category: "enterprise", hasFree: true, letter: "SC" },
  { id: "digitalocean", name: "DigitalOcean", slug: "digitalocean", baseUrl: "https://api.digitalocean.com/v2/genai", description: "DO AI — managed inference", website: "https://cloud.digitalocean.com", color: "#0080ff", category: "enterprise", hasFree: false, letter: "DO" },
  { id: "watsonx", name: "IBM watsonx", slug: "watsonx", baseUrl: "https://us-south.ml.cloud.ibm.com/ml/gateway/v1", description: "Granite models on IBM Cloud", website: "https://cloud.ibm.com", color: "#054ada", category: "enterprise", hasFree: false, letter: "Wx" },
  { id: "databricks", name: "Databricks", slug: "databricks", baseUrl: "https://YOUR_WORKSPACE.databricks.com/api/2.0/serving-endpoints", description: "DBRX, managed AI platform", website: "https://www.databricks.com", color: "#ff3621", category: "enterprise", hasFree: false, letter: "DB" },
  { id: "snowflake", name: "Snowflake Cortex", slug: "snowflake", baseUrl: "https://YOUR_ACCOUNT.snowflakecomputing.com/api/v2/cortex/chat/completions", description: "Cortex AI — data + AI platform", website: "https://app.snowflake.com", color: "#29b5e8", category: "enterprise", hasFree: false, letter: "SF" },
  { id: "modal", name: "Modal", slug: "modal", baseUrl: "https://YOUR_APP--YOUR_NAME.modal.run/v1", description: "Serverless GPU — $30/mo free credits", website: "https://modal.com", color: "#000000", category: "enterprise", hasFree: true, letter: "Md" },

  // ── Media / Specialty ──
  { id: "stability-ai", name: "Stability AI", slug: "stability-ai", baseUrl: "https://api.stability.ai/v2beta", description: "Stable Diffusion, SDXL, video gen", website: "https://platform.stability.ai", color: "#a855f7", category: "media", hasFree: false, letter: "SA" },
  { id: "recraft", name: "Recraft", slug: "recraft", baseUrl: "https://api.recraft.ai/v1", description: "AI design — vector, raster, icons", website: "https://www.recraft.ai", color: "#6366f1", category: "media", hasFree: false, letter: "RC" },
  { id: "voyage-ai", name: "Voyage AI", slug: "voyage-ai", baseUrl: "https://api.voyageai.com/v1", description: "200M free tokens — embeddings & rerank", website: "https://dashboard.voyageai.com", color: "#3b82f6", category: "media", hasFree: true, letter: "VA" },
  { id: "jina-ai", name: "Jina AI", slug: "jina-ai", baseUrl: "https://api.jina.ai/v1", description: "10M free tokens — embeddings, reader", website: "https://jina.ai/api-dashboard", color: "#ea580c", category: "media", hasFree: true, letter: "JA" },
  { id: "segmind", name: "Segmind", slug: "segmind", baseUrl: "https://api.segmind.com/v1", description: "Fast inference — SD, LoRA, video", website: "https://www.segmind.com", color: "#10b981", category: "media", hasFree: true, letter: "SG" },
  { id: "black-forest-labs", name: "Black Forest Labs", slug: "black-forest-labs", baseUrl: "https://api.bfl.ml/v1", description: "FLUX — state-of-the-art image gen", website: "https://bfl.ml", color: "#000000", category: "media", hasFree: false, letter: "BF" },
  { id: "fal-ai", name: "fal.ai", slug: "fal-ai", baseUrl: "https://fal.run", description: "Fast AI inference — images & video", website: "https://fal.ai/dashboard/keys", color: "#8b5cf6", category: "media", hasFree: false, letter: "fa" },
];

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
    // Single batch: DDL — runs ONCE
    const statements = [
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_status (
        url TEXT PRIMARY KEY, is_blocked INTEGER DEFAULT 0, blocked_until TEXT,
        last_used INTEGER DEFAULT 0, disabled INTEGER DEFAULT 0
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS custom_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, base_url TEXT NOT NULL UNIQUE,
        tokens TEXT NOT NULL DEFAULT '[]', enabled INTEGER DEFAULT 1,
        fetched_models TEXT DEFAULT '[]', slug TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        token_selection TEXT DEFAULT 'round-robin', disabled_models TEXT DEFAULT '[]'
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
    try { await env.DB.prepare("ALTER TABLE custom_providers ADD COLUMN disabled_models TEXT DEFAULT '[]'").run(); } catch (e) {}
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
        if (path === "/admin/models/toggle") return await handleModelToggle(request, env);
        if (path === "/admin/models/bulk") return await handleModelBulk(request, env);
        if (path === "/admin/playground/chat") return await handlePlayground(request, env);
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
      if (path === "/admin/models") return await renderAdminModels(env, url);
      if (path === "/admin/playground") return await renderAdminPlayground(env, url);

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

  // ── Fetch custom providers ──
  const { results: customProviders } = await env.DB.prepare(
    "SELECT id, name, slug, base_url, tokens, token_selection FROM custom_providers WHERE enabled = 1"
  ).all();

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
  const needBodyRewrite = rewrittenModelName !== modelName && bodyText;
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
  const { targets, rewrittenModel } = await resolveModelAndTargets(env, openaiBody.model);

  if (targets.length === 0) {
    return new Response(JSON.stringify({
      type: 'error', error: { type: 'invalid_request_error', message: 'No providers available' }
    }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  openaiBody.model = rewrittenModel;

  // Fetch upstream
  const { response, success, target: usedTarget, error: upstreamError } = await fetchUpstream(targets, openaiBody, request.method);

  if (!success) {
    return upstreamFailureResponse(upstreamError, "anthropic", corsHeaders);
  }

  const responseModel = body.model;

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
  const { targets, rewrittenModel } = await resolveModelAndTargets(env, openaiBody.model);

  if (targets.length === 0) {
    return new Response(JSON.stringify({
      error: { code: 503, message: 'No providers available', status: 'UNAVAILABLE' }
    }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  openaiBody.model = rewrittenModel;
  openaiBody.stream = isStream;

  // Fetch upstream
  const { response, success, target: usedTarget, error: upstreamError } = await fetchUpstream(targets, openaiBody, request.method);

  if (!success) {
    return upstreamFailureResponse(upstreamError, "gemini", corsHeaders);
  }

  const responseModel = model;

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
  let rewrittenModel = modelName;

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

  return { targets, rewrittenModel };
}

// Pull a human-readable reason out of an upstream error body, so a provider
// rejection (bad key, quota, region block, ...) reaches the client verbatim
// instead of being reduced to a generic "All providers failed".
function extractUpstreamError(bodyText) {
  if (!bodyText) return "";
  try {
    const parsed = JSON.parse(bodyText);
    const err = parsed?.error;
    if (typeof err === "string") return err;
    if (err?.message) return err.message;
    if (parsed?.message) return parsed.message;
    if (err?.type) return err.type;
  } catch (e) {
    // Not JSON (HTML error page or plain text) — fall through to raw text
  }
  return bodyText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 300);
}

async function fetchUpstream(targets, openaiBody, method) {
  let lastException = null;     // most recent network/timeout failure
  let lastUpstreamError = null; // most recent non-OK response from a provider

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
        return { response, success: true, target, error: null };
      }

      const bodyText = await response.text().catch(() => "");
      lastUpstreamError = {
        status: response.status,
        message: extractUpstreamError(bodyText) || response.statusText || `HTTP ${response.status}`,
        providerId: target.providerId ?? null
      };
    } catch (e) {
      lastException = {
        status: 502,
        message: e.name === "AbortError"
          ? "Upstream request timed out after 120s"
          : (e.message || "Upstream connection failed"),
        providerId: target.providerId ?? null
      };
    }
  }
  return { response: null, success: false, target: null, error: lastUpstreamError || lastException };
}

// Upstream statuses whose meaning the client can act on directly. Everything
// else (401/403 key or region blocks, 5xx outages) is reported as 502 so a
// provider rejection isn't mistaken for a problem with the gateway API key.
const UPSTREAM_PASSTHROUGH_STATUSES = [400, 404, 429];

function upstreamFailureResponse(upstreamError, format, corsHeaders) {
  const status = UPSTREAM_PASSTHROUGH_STATUSES.includes(upstreamError?.status)
    ? upstreamError.status
    : 502;

  const message = upstreamError
    ? `Upstream provider error (${upstreamError.status}): ${upstreamError.message}`
    : "All providers failed";

  const body = format === "gemini"
    ? { error: { code: status, message, status: "UNAVAILABLE", upstream_status: upstreamError?.status ?? null } }
    : { type: "error", error: { type: "api_error", message, upstream_status: upstreamError?.status ?? null } };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
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

  // Auto-fetch models for the new provider. A failure here is not fatal, but
  // it is reported back on the provider page — a provider that rejects the
  // request (bad key, quota, region block) would otherwise look like an
  // empty provider with no explanation.
  let modelsError = "";
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
        } else {
          modelsError = "Provider returned an empty model list";
        }
      } else {
        const errText = await resp.text().catch(() => "");
        modelsError = `HTTP ${resp.status}: ${extractUpstreamError(errText) || resp.statusText}`;
      }
    } catch (e) {
      modelsError = e.name === "AbortError" ? "Model fetch timed out after 8s" : (e.message || "Model fetch failed");
    }
  }

  const location = `/admin/providers/${providerId || ""}?added=1`
    + (modelsError ? `&models_error=${encodeURIComponent(modelsError)}` : "");
  return new Response(null, { status: 302, headers: { "Location": location } });
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

// ─── Model Visibility (per-model enable/disable) ─────────────────────────
// Disabled models are hidden from the public /models listing only.
// Routing is intentionally unaffected so existing callers keep working.

function modelIdsOf(fetchedModelsRaw) {
  try {
    const parsed = JSON.parse(fetchedModelsRaw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(m => (typeof m === "string" ? m : m?.id))
      .filter(id => typeof id === "string" && id.length > 0);
  } catch { return []; }
}

async function handleModelToggle(request, env) {
  const body = await request.json().catch(() => ({}));
  const providerId = parseInt(body.provider_id);
  const modelId = typeof body.model_id === "string" ? body.model_id : "";
  const enabled = body.enabled !== false;

  if (!providerId || !modelId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing provider_id or model_id" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const row = await env.DB.prepare("SELECT disabled_models FROM custom_providers WHERE id = ?")
    .bind(providerId).first();
  if (!row) {
    return new Response(JSON.stringify({ ok: false, error: "Provider not found" }), {
      status: 404, headers: { "Content-Type": "application/json" }
    });
  }

  let disabled;
  try { disabled = new Set(JSON.parse(row.disabled_models || "[]")); } catch { disabled = new Set(); }
  if (enabled) disabled.delete(modelId); else disabled.add(modelId);

  await env.DB.prepare("UPDATE custom_providers SET disabled_models = ? WHERE id = ?")
    .bind(JSON.stringify([...disabled]), providerId).run();

  return new Response(JSON.stringify({ ok: true, disabled: disabled.has(modelId) }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleModelBulk(request, env) {
  const body = await request.json().catch(() => ({}));
  const enabled = body.enabled !== false;
  const hasProvider = body.provider_id !== null && body.provider_id !== undefined && body.provider_id !== "";
  const providerId = hasProvider ? parseInt(body.provider_id) : null;
  const explicitIds = Array.isArray(body.model_ids) && body.model_ids.length > 0
    ? new Set(body.model_ids.filter(id => typeof id === "string" && id.length > 0))
    : null;

  if (hasProvider && !providerId) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid provider_id" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const query = providerId
    ? env.DB.prepare("SELECT id, fetched_models, disabled_models FROM custom_providers WHERE id = ?").bind(providerId)
    : env.DB.prepare("SELECT id, fetched_models, disabled_models FROM custom_providers WHERE enabled = 1");
  const { results } = await query.all();

  let changed = 0;
  const updates = [];
  for (const p of (results || [])) {
    let disabled;
    try { disabled = new Set(JSON.parse(p.disabled_models || "[]")); } catch { disabled = new Set(); }
    // No explicit list → act on every model this provider currently reports
    const targets = explicitIds || new Set(modelIdsOf(p.fetched_models));

    let touched = 0;
    for (const id of targets) {
      if (enabled) {
        if (disabled.delete(id)) touched++;
      } else if (!disabled.has(id)) {
        disabled.add(id); touched++;
      }
    }
    if (touched === 0) continue;
    changed += touched;
    updates.push(
      env.DB.prepare("UPDATE custom_providers SET disabled_models = ? WHERE id = ?")
        .bind(JSON.stringify([...disabled]), p.id)
    );
  }

  if (updates.length > 0) await env.DB.batch(updates);

  return new Response(JSON.stringify({ ok: true, changed, providers: updates.length }), {
    headers: { "Content-Type": "application/json" }
  });
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

// ─── Playground (admin-only chat against a chosen provider/model) ─────────
// Reaches the provider directly instead of going through /v1/chat/completions:
// the admin session has no API key, and slug-only resolution avoids the public
// proxy's "broadcast to every provider" fallback, which is wrong here.

function clampNumber(value, min, max, fallback) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function handlePlayground(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const modelRef = typeof body.model === "string" ? body.model.trim() : "";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!modelRef.includes("/")) {
    return new Response(JSON.stringify({ ok: false, error: "Model must be in provider/model form" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }
  if (messages.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "No messages provided" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  // Split on the FIRST slash so model ids that contain "/" survive
  const slashIndex = modelRef.indexOf("/");
  const slug = modelRef.substring(0, slashIndex);
  const rawModel = modelRef.substring(slashIndex + 1);
  if (!slug || !rawModel) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid model reference" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const isStream = body.stream === true;

  const jsonError = (message, status) => new Response(JSON.stringify({ ok: false, error: message }), {
    status, headers: { "Content-Type": "application/json" }
  });

  try {
    // Resolve the provider server-side. The upstream host comes ONLY from
    // cp.base_url — a client-supplied URL is never used, which is what keeps
    // this endpoint from being an SSRF hole.
    const { results: providers } = await env.DB.prepare(
      "SELECT id, name, base_url, tokens, token_selection FROM custom_providers WHERE enabled = 1"
    ).all();
    const cp = (providers || []).find(p => (p.slug || providerSlug(p.name)) === slug);
    if (!cp) return jsonError("Unknown provider slug: " + slug, 400);

    const tokens = parseTokens(cp.tokens);
    const selectedToken = await selectToken(tokens, cp.token_selection || 'round-robin', cp.id, env);
    if (!selectedToken) return jsonError("No enabled tokens for provider " + cp.name, 400);

    // Build the upstream payload server-side; clamp anything numeric
    const outgoing = [];
    const systemPrompt = typeof body.system === "string" ? body.system.trim() : "";
    if (systemPrompt) outgoing.push({ role: "system", content: systemPrompt });
    for (const m of messages) {
      if (!m || typeof m.content !== "string") continue;
      const role = m.role === "assistant" || m.role === "system" ? m.role : "user";
      outgoing.push({ role, content: m.content });
    }
    if (outgoing.length === 0) return jsonError("No usable messages provided", 400);

    const openaiBody = {
      model: rawModel,
      messages: outgoing,
      temperature: clampNumber(body.temperature, 0, 2, 0.7),
      max_tokens: Math.round(clampNumber(body.max_tokens, 1, 32000, 1024)),
      stream: isStream,
    };
    if (body.top_p !== undefined && body.top_p !== null && body.top_p !== "") {
      openaiBody.top_p = clampNumber(body.top_p, 0.01, 1, 1);
    }

    const targetUrl = cp.base_url.replace(/\/$/, "").replace(/\/v1\/?$/, "") + "/v1/chat/completions";

    // request.signal lets the browser's Stop button cancel the upstream call
    const controller = new AbortController();
    const onClientAbort = () => controller.abort();
    if (request.signal) request.signal.addEventListener("abort", onClientAbort);
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    let upstream;
    try {
      upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedToken.value}`
        },
        body: JSON.stringify(openaiBody),
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (request.signal) request.signal.removeEventListener("abort", onClientAbort);
      return jsonError(e.name === "AbortError" ? "Request cancelled or timed out" : e.message, 502);
    }

    // The token was consumed either way, so keep the least-used strategy honest
    await trackTokenUsage(cp.id, selectedToken._originalIndex, env).catch(() => {});

    if (!upstream.ok) {
      clearTimeout(timeoutId);
      if (request.signal) request.signal.removeEventListener("abort", onClientAbort);
      const errText = await upstream.text().catch(() => "");
      return new Response(JSON.stringify({
        ok: false,
        error: `HTTP ${upstream.status}: ${errText.substring(0, 400)}`
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (isStream) {
      clearTimeout(timeoutId);
      // captureStreamUsage taps the SSE body for real usage and records it
      const streamed = captureStreamUsage(upstream, "playground", "/admin/playground", rawModel, env, null);
      return new Response(streamed.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no"
        }
      });
    }

    const startedAt = Date.now();
    const data = await upstream.json().catch(() => null);
    clearTimeout(timeoutId);
    if (request.signal) request.signal.removeEventListener("abort", onClientAbort);

    if (!data) return jsonError("Upstream returned malformed JSON", 502);

    await trackUsage(
      new Response(JSON.stringify(data)), "playground", "/admin/playground", rawModel, env, null
    ).catch(() => {});

    return new Response(JSON.stringify({
      ok: true,
      reply: data.choices?.[0]?.message?.content || "",
      model: rawModel,
      provider: cp.name,
      usage: data.usage || null,
      latency_ms: Date.now() - startedAt
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return jsonError(e.message || "Unexpected error", 500);
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
      "SELECT id, name, slug, base_url, tokens, fetched_models, token_selection, disabled_models FROM custom_providers WHERE enabled = 1"
    ).all();

    if (customProviders) {
      for (const cp of customProviders) {
        const slug = cp.slug || providerSlug(cp.name);
        const cachedModels = JSON.parse(cp.fetched_models || "[]");
        // Models the admin hid from this listing (routing still allows them)
        const disabledModels = new Set(JSON.parse(cp.disabled_models || "[]"));

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
          // Hidden by admin — omitted from the listing only, still routable
          if (disabledModels.has(modelId)) continue;
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
    <a href="/admin/models" class="nav-item ${activeTab === 'models' ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
      <span>Models</span>
    </a>
    <a href="/admin/playground" class="nav-item ${activeTab === 'playground' ? 'active' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>Playground</span>
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
    SELECT COALESCE(k.name, CASE WHEN u.api_key_id IS NULL THEN 'Playground' ELSE 'anonymous' END) as key_name,
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

// Escape values that originate outside the worker (upstream error text, ...)
// before interpolating them into admin HTML.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
        <form method="POST" action="/admin/providers/toggle-custom" style="display:inline">
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

  // Build catalog cards HTML
  const catalogCardsHTML = PROVIDER_CATALOG.map(p => `
    <div class="catalog-card" data-cat-id="${p.id}" data-cat="${p.category}" data-cat-name="${p.name.toLowerCase()}" data-cat-slug="${p.slug}" onclick="selectCatalogProvider('${p.id}')">
      <div class="catalog-card-inner">
        <div class="catalog-logo" style="background:${p.color}20;border-color:${p.color}40">
          <span style="color:${p.color};font-weight:800;font-size:${p.letter.length > 2 ? '11' : '14'}px">${p.letter}</span>
        </div>
        <div class="catalog-card-body">
          <div class="catalog-card-name">${p.name}</div>
          <div class="catalog-card-desc">${p.description}</div>
        </div>
        <div class="catalog-card-meta">
          ${p.hasFree ? '<span class="catalog-free-badge">★ Free</span>' : ''}
          <a href="${p.website}" target="_blank" rel="noopener" class="catalog-get-key" onclick="event.stopPropagation()">Get API Key →</a>
        </div>
      </div>
    </div>`).join("");

  const content = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Providers</h2>
        <p>Manage AI providers, API keys, and load balancing</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="toggleManualForm()">+ Add Custom Provider</button>
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

    <!-- ═══ Your Providers ═══ -->
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);margin:0">Your Providers</h3>
      </div>

      <!-- Search & Filter Bar -->
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:240px;position:relative">
          <svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);opacity:0.4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" id="provider-search" placeholder="Search your providers..." style="width:100%;padding:10px 14px 10px 40px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius);color:var(--text-primary);font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:var(--transition)" onfocus="this.style.borderColor='var(--border-active)'" onblur="this.style.borderColor='var(--border-subtle)'" oninput="filterProviders()">
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm filter-btn active" data-filter="all" onclick="setFilter('all')">All</button>
          <button class="btn btn-sm filter-btn" data-filter="active" onclick="setFilter('active')">Active</button>
          <button class="btn btn-sm filter-btn" data-filter="disabled" onclick="setFilter('disabled')">Disabled</button>
        </div>
      </div>

      <!-- Add Provider Form -->
      <div id="addProviderSection" style="display:none;margin-bottom:24px;background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:24px">
        <div id="catalog-prefill-banner" style="display:none;margin-bottom:16px;padding:12px 16px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;align-items:center;gap:12px">
          <div id="prefill-logo" style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div id="prefill-name" style="font-size:14px;font-weight:700;color:var(--text-primary)"></div>
            <div id="prefill-desc" style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
          </div>
          <a id="prefill-link" href="#" target="_blank" rel="noopener" class="btn btn-sm btn-secondary" style="white-space:nowrap;font-size:11px;text-decoration:none">Get API Key →</a>
        </div>
        <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:16px">
          <span id="form-title-text">Add New Provider</span>
        </h3>
        <form method="POST" action="/admin/providers/add" id="add-provider-form">
          <input type="hidden" name="catalog_id" id="catalog-id-field" value="">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label>Provider Name</label>
              <input type="text" name="name" id="provider-name-input" placeholder="e.g. My OpenAI Proxy" required>
            </div>
            <div class="form-group">
              <label>Provider ID (slug)</label>
              <input type="text" name="slug" id="provider-slug-input" placeholder="e.g. my-openai-proxy" pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only">
              <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block">Used in model IDs: <code id="slug-preview">slug/model-name</code></small>
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label>Base URL</label>
              <input type="url" name="base_url" id="provider-url-input" placeholder="https://api.example.com/v1" required>
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label>API Tokens (one per line)</label>
              <textarea name="tokens" id="provider-tokens-input" placeholder="sk-token-1&#10;sk-token-2&#10;sk-token-3" required></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Add Provider</button>
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('addProviderSection').style.display='none'">Cancel</button>
          </div>
        </form>
      </div>

      <!-- Provider Cards Grid -->
      <div id="provider-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:32px">
        ${providerCards || '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px dashed var(--border-medium);grid-column:1/-1">No providers yet. Pick one from the catalog below or click "+ Add Custom Provider".</div>'}
      </div>
    </div>

    <!-- ═══ Provider Catalog — Quick Start ═══ -->
    <div class="catalog-section">
      <div class="catalog-header">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0 0 4px 0">⚡ Quick Start — Pick a Provider</h3>
          <p style="font-size:12px;color:var(--text-muted);margin:0">Choose a provider below, get your API key from their website, then paste it here.</p>
        </div>
      </div>

      <!-- Catalog Search -->
      <div style="position:relative;margin-bottom:12px">
        <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:0.4" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" id="catalog-search" placeholder="Search catalog providers..." oninput="filterCatalog()" style="width:100%;padding:8px 12px 8px 34px;background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:var(--radius);color:var(--text-primary);font-size:12px;font-family:'Inter',sans-serif;outline:none;transition:var(--transition)">
      </div>

      <!-- Category Tabs -->
      <div class="catalog-tabs">
        <button class="catalog-tab active" data-cat-filter="all" onclick="setCatalogFilter('all',this)">All</button>
        <button class="catalog-tab" data-cat-filter="frontier" onclick="setCatalogFilter('frontier',this)">Frontier</button>
        <button class="catalog-tab" data-cat-filter="inference" onclick="setCatalogFilter('inference',this)">Inference</button>
        <button class="catalog-tab" data-cat-filter="gateway" onclick="setCatalogFilter('gateway',this)">Gateway</button>
        <button class="catalog-tab" data-cat-filter="regional" onclick="setCatalogFilter('regional',this)">Regional</button>
        <button class="catalog-tab" data-cat-filter="enterprise" onclick="setCatalogFilter('enterprise',this)">Enterprise</button>
        <button class="catalog-tab" data-cat-filter="media" onclick="setCatalogFilter('media',this)">Media</button>
        <button class="catalog-tab" data-cat-filter="free" onclick="setCatalogFilter('free',this)">★ Free Tier</button>
      </div>

      <!-- Catalog Grid -->
      <div class="catalog-grid" id="catalog-grid">
        ${catalogCardsHTML}
      </div>
    </div>



    <script>
    // ── Your Providers filter ──
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

    // ── Manual form toggle (resets any catalog prefill) ──
    function toggleManualForm() {
      var section = document.getElementById('addProviderSection');
      if (section.style.display === 'none' || !section.style.display) {
        document.getElementById('catalog-prefill-banner').style.display = 'none';
        document.getElementById('provider-name-input').value = '';
        document.getElementById('provider-slug-input').value = '';
        delete document.getElementById('provider-slug-input').dataset.touched;
        document.getElementById('provider-url-input').value = '';
        document.getElementById('provider-tokens-input').value = '';
        document.getElementById('catalog-id-field').value = '';
        document.getElementById('form-title-text').textContent = 'Add New Provider';
        document.getElementById('slug-preview').textContent = 'slug/model-name';
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('provider-name-input').focus();
      } else {
        section.style.display = 'none';
      }
    }

    // ── Catalog filter & search ──
    var CATALOG_DATA = ${JSON.stringify(PROVIDER_CATALOG)};
    var currentCatalogFilter = 'all';

    function setCatalogFilter(cat, btn) {
      currentCatalogFilter = cat;
      document.querySelectorAll('.catalog-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterCatalog();
    }

    function filterCatalog() {
      var q = (document.getElementById('catalog-search').value || '').toLowerCase();
      document.querySelectorAll('.catalog-card').forEach(card => {
        var name = (card.dataset.catName || '');
        var slug = (card.dataset.catSlug || '');
        var cat = card.dataset.cat || '';
        var isFree = card.querySelector('.catalog-free-badge') !== null;
        var matchSearch = !q || name.includes(q) || slug.includes(q);
        var matchCat = currentCatalogFilter === 'all' || cat === currentCatalogFilter || (currentCatalogFilter === 'free' && isFree);
        card.style.display = (matchSearch && matchCat) ? '' : 'none';
      });
    }

    // ── Select catalog provider → open form pre-filled ──
    function selectCatalogProvider(id) {
      var p = CATALOG_DATA.find(x => x.id === id);
      if (!p) return;

      // Show form
      var section = document.getElementById('addProviderSection');
      section.style.display = 'block';

      // Show prefill banner
      var banner = document.getElementById('catalog-prefill-banner');
      banner.style.display = 'flex';
      document.getElementById('prefill-logo').style.background = p.color + '20';
      document.getElementById('prefill-logo').style.border = '1px solid ' + p.color + '40';
      document.getElementById('prefill-logo').innerHTML = '<span style="color:' + p.color + ';font-weight:800;font-size:12px">' + p.letter + '</span>';
      document.getElementById('prefill-name').textContent = p.name;
      document.getElementById('prefill-desc').textContent = p.description;
      var link = document.getElementById('prefill-link');
      link.href = p.website;

      // Fill form fields
      document.getElementById('provider-name-input').value = p.name;
      document.getElementById('provider-slug-input').value = p.slug;
      document.getElementById('provider-slug-input').dataset.touched = 'true';
      document.getElementById('provider-url-input').value = p.baseUrl;
      document.getElementById('catalog-id-field').value = p.id;
      document.getElementById('form-title-text').textContent = 'Add ' + p.name;
      document.getElementById('slug-preview').textContent = p.slug + '/model-name';

      // Focus tokens field
      document.getElementById('provider-tokens-input').focus();

      // Scroll to form
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Form slug auto-generation ──
    document.querySelector('#addProviderSection input[name="name"]').addEventListener('input', function() {
      if (document.getElementById('provider-slug-input').dataset.touched) return;
      const slug = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 32) || 'provider';
      document.getElementById('slug-preview').textContent = slug + '/model-name';
      document.getElementById('provider-slug-input').value = slug;
    });
    document.querySelector('#addProviderSection input[name="slug"]').addEventListener('input', function() {
      this.dataset.touched = 'true';
      document.getElementById('slug-preview').textContent = this.value + '/model-name';
    });
    </script>

    <style>
      /* ── Existing filter buttons ── */
      .filter-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:500;background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-secondary);cursor:pointer;transition:var(--transition)}
      .filter-btn:hover{border-color:var(--border-medium);color:var(--text-primary)}
      .filter-btn.active{background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:var(--accent-blue)}

      /* ── Catalog Section ── */
      .catalog-section{margin-bottom:28px;background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:20px 24px}
      .catalog-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}

      /* ── Catalog Tabs ── */
      .catalog-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
      .catalog-tab{padding:5px 12px;border-radius:7px;font-size:11px;font-weight:600;background:transparent;border:1px solid var(--border-subtle);color:var(--text-secondary);cursor:pointer;transition:var(--transition);font-family:'Inter',sans-serif}
      .catalog-tab:hover{border-color:var(--border-medium);color:var(--text-primary)}
      .catalog-tab.active{background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:var(--accent-blue)}

      /* ── Catalog Grid ── */
      .catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
      .catalog-card{background:rgba(255,255,255,0.02);border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);overflow:hidden}
      .catalog-card:hover{border-color:var(--border-active);transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,0.3)}
      .catalog-card-inner{padding:14px 16px;display:flex;align-items:flex-start;gap:12px}

      /* ── Catalog Logo ── */
      .catalog-logo{width:40px;height:40px;border-radius:10px;border:1px solid;display:flex;align-items:center;justify-content:center;flex-shrink:0}

      /* ── Catalog Card Body ── */
      .catalog-card-body{flex:1;min-width:0}
      .catalog-card-name{font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .catalog-card-desc{font-size:10px;color:var(--text-muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

      /* ── Catalog Meta ── */
      .catalog-card-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
      .catalog-free-badge{font-size:9px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.1);padding:2px 6px;border-radius:5px;white-space:nowrap}
      .catalog-get-key{font-size:9px;font-weight:600;color:var(--accent-blue);text-decoration:none;white-space:nowrap;opacity:0.7;transition:opacity 0.2s}
      .catalog-get-key:hover{opacity:1}

      /* ── Responsive ── */
      @media(max-width:1100px){#provider-grid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:900px){.catalog-grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}}
      @media(max-width:700px){#provider-grid{grid-template-columns:1fr}.catalog-grid{grid-template-columns:1fr}}
  `;

  return new Response(adminLayout("Providers", "providers", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── Admin: Models Tab (curate what /models advertises) ──────────────────

async function renderAdminModels(env, url) {
  const { results: providers } = await env.DB.prepare(
    "SELECT id, name, slug, enabled, disabled_models, fetched_models FROM custom_providers ORDER BY enabled DESC, name"
  ).all();

  // A disabled provider has no models in the live catalog — /models and the
  // playground both skip the provider outright — so its models are left out
  // here too. Listing them would only offer switches that change nothing.
  // They are counted in the banner below so the provider's models never look
  // like they vanished.
  const offProviders = (providers || []).filter(p => p.enabled !== 1);
  const offModels = offProviders.reduce((n, p) => n + modelIdsOf(p.fetched_models).length, 0);

  // One flat row per model. `fetched_models` is a string[] when written by
  // handleFetchModels and an object array when written by handleAddProvider /
  // handleModelsEndpoint, so normalize both shapes here.
  const rows = [];
  for (const p of (providers || [])) {
    if (p.enabled !== 1) continue;
    const slug = p.slug || providerSlug(p.name);
    const raw = JSON.parse(p.fetched_models || "[]");
    if (!Array.isArray(raw)) continue;
    let disabled;
    try { disabled = new Set(JSON.parse(p.disabled_models || "[]")); } catch { disabled = new Set(); }
    for (const m of raw) {
      const mid = typeof m === "string" ? m : m?.id;
      if (typeof mid !== "string" || mid.length === 0) continue;
      rows.push({
        pid: p.id,
        pslug: slug,
        pname: p.name,
        mid,
        disabled: disabled.has(mid),
        ctx: (typeof m === "object" && m && Number(m.context_window)) || 0
      });
    }
  }

  const totalModels = rows.length;
  const disabledModels = rows.filter(r => r.disabled).length;
  const enabledModels = totalModels - disabledModels;
  const providerCount = new Set(rows.map(r => r.pid)).size;

  const providerOptions = (providers || [])
    .filter(p => rows.some(r => r.pid === p.id))
    .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");

  // Server-render the first page only so the page is readable without JS; the
  // client takes over filtering and pagination from the same DATA blob.
  const FIRST_PAGE = 100;

  const renderRow = (r, idx) => `
    <tr data-idx="${idx}" style="${r.disabled ? 'opacity:0.5;' : ''}">
      <td class="sel-cell"><input type="checkbox" class="sel-box" data-i="${idx}" onchange="toggleSelect(this)"></td>
      <td><span class="badge badge-slate">${escapeHtml(r.pname)}</span></td>
      <td><span class="mono" style="color:var(--text-secondary)">${escapeHtml(r.pslug)}/</span><span class="mono" style="color:var(--accent-blue);font-weight:600">${escapeHtml(r.mid)}</span></td>
      <td class="mono" style="color:var(--text-muted)">${r.ctx ? (r.ctx / 1000).toFixed(0) + 'k' : '—'}</td>
      <td style="text-align:center">
        <span class="model-state" style="font-size:11px;font-weight:600;color:${r.disabled ? 'var(--accent-amber)' : 'var(--accent-green)'}">${r.disabled ? 'Hidden' : 'Listed'}</span>
      </td>
      <td style="text-align:center">
        <label class="toggle toggle-sm">
          <input type="checkbox" data-pid="${r.pid}" data-mid="${escapeHtml(r.mid)}" ${r.disabled ? '' : 'checked'} onchange="toggleModel(this)">
          <span class="slider"></span>
        </label>
      </td>
    </tr>`;

  const firstPageRows = rows.slice(0, FIRST_PAGE).map(renderRow).join("");

  // Escape "<" so an upstream-supplied model name can never close this script tag
  const dataBlob = JSON.stringify(rows).replace(/</g, "\\u003c");

  const content = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Models</h2>
        <p>Choose which models appear at <span class="mono">/models</span>. Hidden models stay callable by ID.</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary btn-sm" onclick="bulkModels(false)">Hide all filtered</button>
        <button class="btn btn-secondary btn-sm" onclick="bulkModels(true)">Show all filtered</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card blue">
        <div class="label">Total Models</div>
        <div class="value" id="stat-total">${totalModels}</div>
        <div class="sub">across ${providerCount} provider${providerCount === 1 ? '' : 's'}</div>
      </div>
      <div class="stat-card green">
        <div class="label">Listed</div>
        <div class="value" id="stat-enabled">${enabledModels}</div>
        <div class="sub">visible at /models</div>
      </div>
      <div class="stat-card amber">
        <div class="label">Hidden</div>
        <div class="value" id="stat-disabled">${disabledModels}</div>
        <div class="sub">routing unaffected</div>
      </div>
    </div>

    <div class="form-card" style="padding:16px 20px">
      <div class="model-filters">
        <div class="form-group">
          <label>Provider</label>
          <select id="f-provider" onchange="applyFilters()">
            <option value="">All providers</option>
            ${providerOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Search</label>
          <input type="text" id="f-search" placeholder="Filter by model ID…" oninput="applyFilters()" style="font-family:'SF Mono',Consolas,monospace">
        </div>
        <div class="form-group">
          <label>Show</label>
          <select id="f-state" onchange="applyFilters()">
            <option value="all">All models</option>
            <option value="on">Listed only</option>
            <option value="off">Hidden only</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Selection bar — only rendered when something is checked -->
    <div class="sel-bar" id="sel-bar" style="display:none">
      <span class="sel-count" id="sel-count">0 selected</span>
      <button class="btn btn-secondary btn-sm" id="sel-all-filtered" onclick="selectAllFiltered()">Select all filtered</button>
      <button class="btn btn-secondary btn-sm" onclick="clearSelection()">Clear</button>
      <span class="sel-spacer"></span>
      <button class="btn btn-secondary btn-sm" onclick="bulkSelection(false)">Hide selected</button>
      <button class="btn btn-secondary btn-sm" onclick="bulkSelection(true)">Show selected</button>
    </div>

    <div class="table-wrap">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th class="sel-cell"><input type="checkbox" class="sel-box" id="sel-all" title="Select every model on this page" onchange="toggleSelectPage(this)"></th>
              <th>Provider</th>
              <th>Model ID</th>
              <th>Context</th>
              <th style="text-align:center">Status</th>
              <th style="text-align:center">Listed</th>
            </tr>
          </thead>
          <tbody id="models-tbody">
            ${firstPageRows || '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No models yet. Add a provider and fetch its models first.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div id="models-pager" class="models-pager"></div>
    </div>

    <div style="margin-top:20px;padding:16px 20px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);line-height:1.6">
      <strong style="color:var(--accent-amber)">i️ Hiding a model only affects the public list.</strong><br>
      <span class="mono" style="color:var(--text-primary)">POST /v1/chat/completions</span> with a hidden model ID keeps working exactly as before, so existing callers never break.
    </div>

    <style>
      .model-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
      .sel-cell{width:38px;padding-left:16px;padding-right:0}
      .sel-box{width:15px;height:15px;accent-color:var(--accent-blue);cursor:pointer;vertical-align:middle}
      .sel-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:10px 16px;border-radius:var(--radius);background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.22);font-size:12px;color:var(--text-secondary)}
      .sel-bar .sel-count{font-weight:700;color:var(--accent-blue)}
      .sel-bar .sel-spacer{flex:1;min-width:8px}
      .models-pager{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--border-subtle);font-size:12px;color:var(--text-muted);flex-wrap:wrap}
      .models-pager button{padding:5px 11px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid var(--border-subtle);color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:var(--transition)}
      .models-pager button:hover:not(:disabled){background:rgba(255,255,255,0.08);color:var(--text-primary)}
      .models-pager button:disabled{opacity:0.35;cursor:not-allowed}
      @media(max-width:768px){.model-filters{grid-template-columns:1fr}}
    </style>

    <script>
    var DATA = ${dataBlob};
    var PAGE_SIZE = 50;
    var page = 0;
    var filtered = DATA.slice();
    // Selection is tracked by index into DATA, not by row position, so it
    // survives paging and changes to the filters.
    var selected = {};
    DATA.forEach(function (r, i) { r.i = i; });

    function showToast(message, type) {
      var existing = document.querySelector('.toast');
      if (existing) existing.remove();
      var t = document.createElement('div');
      t.className = 'toast';
      var ok = type !== 'error';
      t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:500;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.4);' +
        (ok ? 'background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3)'
            : 'background:rgba(244,63,94,0.15);color:#f43f5e;border:1px solid rgba(244,63,94,0.3)');
      t.textContent = message; // textContent — never innerHTML
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 2500);
    }

    // Recompute the visible set from the controls. Kept separate from
    // applyFilters so a bulk edit can refresh the rows without also throwing
    // away the page the user is reading.
    function computeFiltered() {
      var pid = document.getElementById('f-provider').value;
      var term = document.getElementById('f-search').value.trim().toLowerCase();
      var state = document.getElementById('f-state').value;
      filtered = DATA.filter(function (r) {
        if (pid && String(r.pid) !== pid) return false;
        if (term && r.mid.toLowerCase().indexOf(term) === -1) return false;
        if (state === 'on' && r.disabled) return false;
        if (state === 'off' && !r.disabled) return false;
        return true;
      });
    }

    function applyFilters() {
      computeFiltered();
      page = 0;
      renderPage();
    }

    function renderPage() {
      var tbody = document.getElementById('models-tbody');
      var pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      if (page >= pages) page = pages - 1;
      var slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      if (slice.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No models match these filters.</td></tr>';
      } else {
        tbody.innerHTML = slice.map(function (r) {
          var ctx = r.ctx ? (r.ctx / 1000).toFixed(0) + 'k' : '—';
          var stateColor = r.disabled ? 'var(--accent-amber)' : 'var(--accent-green)';
          return '<tr style="' + (r.disabled ? 'opacity:0.5;' : '') + '">' +
            '<td class="sel-cell"><input type="checkbox" class="sel-box" data-i="' + r.i + '"' +
              (selected[r.i] ? ' checked' : '') + ' onchange="toggleSelect(this)"></td>' +
            '<td><span class="badge badge-slate">' + esc(r.pname) + '</span></td>' +
            '<td><span class="mono" style="color:var(--text-secondary)">' + esc(r.pslug) + '/</span>' +
              '<span class="mono" style="color:var(--accent-blue);font-weight:600">' + esc(r.mid) + '</span></td>' +
            '<td class="mono" style="color:var(--text-muted)">' + ctx + '</td>' +
            '<td style="text-align:center"><span class="model-state" style="font-size:11px;font-weight:600;color:' + stateColor + '">' +
              (r.disabled ? 'Hidden' : 'Listed') + '</span></td>' +
            '<td style="text-align:center"><label class="toggle toggle-sm">' +
              '<input type="checkbox" data-pid="' + r.pid + '" data-mid="' + esc(r.mid) + '" ' +
              (r.disabled ? '' : 'checked') + ' onchange="toggleModel(this)"><span class="slider"></span></label></td>' +
            '</tr>';
        }).join('');
      }
      var pager = document.getElementById('models-pager');
      pager.innerHTML = filtered.length === 0 ? '' :
        '<span>' + filtered.length + ' model' + (filtered.length === 1 ? '' : 's') +
        ' · page ' + (page + 1) + ' of ' + pages + '</span>' +
        '<button onclick="gotoPage(' + (page - 1) + ')" ' + (page === 0 ? 'disabled' : '') + '>‹ Prev</button>' +
        '<button onclick="gotoPage(' + (page + 1) + ')" ' + (page >= pages - 1 ? 'disabled' : '') + '>Next ›</button>';
      syncSelection();
    }

    // ── Selection ──────────────────────────────────────────────────────────
    function selectedIndices() {
      return Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number);
    }

    function toggleSelect(checkbox) {
      var i = Number(checkbox.dataset.i);
      if (checkbox.checked) selected[i] = true; else delete selected[i];
      syncSelection();
    }

    function toggleSelectPage(checkbox) {
      var slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      slice.forEach(function (r) {
        if (checkbox.checked) selected[r.i] = true; else delete selected[r.i];
      });
      renderPage();
    }

    function selectAllFiltered() {
      filtered.forEach(function (r) { selected[r.i] = true; });
      renderPage();
    }

    function clearSelection() {
      selected = {};
      renderPage();
    }

    // Refresh the header checkbox, the bar's count and the bar's visibility.
    // Called after every render so the three never drift apart.
    function syncSelection() {
      var count = selectedIndices().length;
      var bar = document.getElementById('sel-bar');
      bar.style.display = count === 0 ? 'none' : 'flex';
      document.getElementById('sel-count').textContent = count + ' selected';
      var allFiltered = filtered.length > 0 && filtered.every(function (r) { return selected[r.i]; });
      var btn = document.getElementById('sel-all-filtered');
      // Nothing to offer once everything visible is already selected (or there
      // is nothing visible at all).
      btn.style.display = (allFiltered || filtered.length === 0) ? 'none' : '';
      btn.textContent = 'Select all ' + filtered.length + ' filtered';

      var slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      var onPage = slice.filter(function (r) { return selected[r.i]; }).length;
      var head = document.getElementById('sel-all');
      head.checked = slice.length > 0 && onPage === slice.length;
      head.indeterminate = onPage > 0 && onPage < slice.length;
    }

    // Act on exactly what is checked — not on the whole filter.
    async function bulkSelection(enabled) {
      var idx = selectedIndices();
      if (idx.length === 0) { showToast('Nothing selected', 'error'); return; }

      var byProvider = {};
      idx.forEach(function (i) {
        var r = DATA[i];
        if (!r) return;
        if (!byProvider[r.pid]) byProvider[r.pid] = [];
        byProvider[r.pid].push(r.mid);
      });
      var pids = Object.keys(byProvider);
      if (!confirm((enabled ? 'Show ' : 'Hide ') + idx.length + ' selected model(s)?')) return;

      var totalChanged = 0;
      try {
        for (var i = 0; i < pids.length; i++) {
          var res = await fetch('/admin/models/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider_id: Number(pids[i]), enabled: enabled, model_ids: byProvider[pids[i]] })
          });
          var data = await res.json().catch(function () { return {}; });
          if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
          totalChanged += data.changed || 0;
        }
        idx.forEach(function (i) { if (DATA[i]) DATA[i].disabled = !enabled; });
        selected = {};
        refreshStats();
        // The edited rows may no longer match the active filter — "Only hidden"
        // after a Show, say — so recompute rather than leaving stale rows up.
        computeFiltered();
        renderPage();
        showToast((enabled ? 'Listed ' : 'Hidden ') + totalChanged + ' model' + (totalChanged === 1 ? '' : 's'), 'success');
      } catch (e) {
        showToast('Bulk update failed: ' + e.message, 'error');
        // Server state is unknown after a partial run — reload to resync
        setTimeout(function () { location.reload(); }, 1500);
      }
    }

    function gotoPage(n) {
      var pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      page = Math.min(pages - 1, Math.max(0, n));
      renderPage();
    }

    // Model IDs come from upstream providers, so escape everything interpolated
    // into the table markup above.
    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function refreshStats() {
      var dis = DATA.filter(function (r) { return r.disabled; }).length;
      document.getElementById('stat-total').textContent = DATA.length;
      document.getElementById('stat-enabled').textContent = DATA.length - dis;
      document.getElementById('stat-disabled').textContent = dis;
    }

    async function toggleModel(checkbox) {
      var pid = parseInt(checkbox.dataset.pid, 10);
      var mid = checkbox.dataset.mid;
      var wanted = checkbox.checked;
      var row = DATA.filter(function (r) { return r.pid === pid && r.mid === mid; })[0];
      checkbox.disabled = true;
      try {
        var res = await fetch('/admin/models/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider_id: pid, model_id: mid, enabled: wanted })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
        if (row) row.disabled = data.disabled === true;
        checkbox.checked = !(data.disabled === true);
        refreshStats();
        renderPage();
        showToast(data.disabled ? 'Hidden from /models' : 'Listed at /models', 'success');
      } catch (e) {
        checkbox.checked = !wanted; // revert the optimistic flip
        showToast('Failed: ' + e.message, 'error');
      } finally {
        checkbox.disabled = false;
      }
    }

    async function bulkModels(enabled) {
      // Group the *filtered* rows by provider and send the explicit IDs, so a
      // search or state filter narrows the action instead of hitting every
      // model the provider reports.
      var byProvider = {};
      filtered.forEach(function (r) {
        if (!byProvider[r.pid]) byProvider[r.pid] = [];
        byProvider[r.pid].push(r.mid);
      });
      var pids = Object.keys(byProvider);
      if (pids.length === 0) { showToast('Nothing to change', 'error'); return; }
      var verb = enabled ? 'show' : 'hide';
      if (!confirm('This will ' + verb + ' ' + filtered.length + ' model(s) in the current filter.')) return;

      var totalChanged = 0;
      try {
        for (var i = 0; i < pids.length; i++) {
          var res = await fetch('/admin/models/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider_id: Number(pids[i]), enabled: enabled, model_ids: byProvider[pids[i]] })
          });
          var data = await res.json().catch(function () { return {}; });
          if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
          totalChanged += data.changed || 0;
        }
        // Only the providers in the filter were touched, so mirror that locally
        DATA.forEach(function (r) {
          if (byProvider[r.pid] && byProvider[r.pid].indexOf(r.mid) !== -1) r.disabled = !enabled;
        });
        refreshStats();
        applyFilters();
        showToast((enabled ? 'Listed ' : 'Hidden ') + totalChanged + ' model' + (totalChanged === 1 ? '' : 's'), 'success');
      } catch (e) {
        showToast('Bulk update failed: ' + e.message, 'error');
        // Server state is unknown after a partial run — reload to resync
        setTimeout(function () { location.reload(); }, 1500);
      }
    }

    renderPage();
    </script>
  `;

  return new Response(adminLayout("Models", "models", content), {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

// ─── Admin: Playground (chat against a chosen provider/model) ────────────

async function renderAdminPlayground(env, url) {
  const { results: providers } = await env.DB.prepare(
    "SELECT id, name, slug, disabled_models, fetched_models, tokens FROM custom_providers WHERE enabled = 1 ORDER BY name"
  ).all();

  const groups = [];
  for (const p of (providers || [])) {
    const slug = p.slug || providerSlug(p.name);
    const raw = JSON.parse(p.fetched_models || "[]");
    if (!Array.isArray(raw)) continue;
    let disabled;
    try { disabled = new Set(JSON.parse(p.disabled_models || "[]")); } catch { disabled = new Set(); }
    const models = [];
    for (const m of raw) {
      const mid = typeof m === "string" ? m : m?.id;
      if (typeof mid !== "string" || mid.length === 0) continue;
      models.push({ mid, hidden: disabled.has(mid) });
    }
    if (models.length === 0) continue;
    groups.push({ name: p.name, slug, models });
  }

  const totalModels = groups.reduce((n, g) => n + g.models.length, 0);

  // Hidden models are deliberately included: the point of a playground is to
  // try a model before publishing it to /models. They are marked, not omitted.
  const optionGroups = groups.map(g => `
    <optgroup label="${escapeHtml(g.name)} (${escapeHtml(g.slug)})">
      ${g.models.map(m => `<option value="${escapeHtml(g.slug + "/" + m.mid)}">${escapeHtml(m.mid)}${m.hidden ? ' · hidden' : ''}</option>`).join("")}
    </optgroup>`).join("");

  const content = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Playground</h2>
        <p>Send a message to any model on an enabled provider and watch the reply stream back</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary btn-sm" id="clear-btn" title="Clear the conversation">Clear</button>
      </div>
    </div>

    ${totalModels === 0 ? `
    <div class="alert alert-blue">
      <span>ⓘ</span>
      <span>No models available yet. Add a provider at <a href="/admin/providers" style="color:var(--accent-blue)">Providers</a> and fetch its models first.</span>
    </div>` : ""}

    <div class="pg-grid">
      <div class="pg-chat-card">
        <div class="pg-toolbar">
          <div class="form-group pg-model-group">
            <label>Model</label>
            <select id="pg-model" ${totalModels === 0 ? 'disabled' : ''}>
              ${optionGroups || '<option value="">No models available</option>'}
            </select>
          </div>
          <div class="pg-toolbar-right">
            <span class="pg-meta" id="pg-meta"></span>
            <button class="btn btn-secondary btn-sm" id="settings-toggle" title="Show or hide settings">⚙︎ Settings</button>
          </div>
        </div>

        <div class="pg-messages" id="pg-messages">
          <div class="pg-empty" id="pg-empty">
            <div class="pg-empty-icon">💬</div>
            <div>Pick a model and send your first message.</div>
            <div class="pg-empty-hint">Switch on <strong>Stream</strong> in Settings to watch tokens arrive live.</div>
          </div>
        </div>

        <form class="pg-composer" id="pg-form" onsubmit="sendMessage(event)">
          <textarea id="pg-input" rows="1" placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
            ${totalModels === 0 ? 'disabled' : ''}></textarea>
          <button type="submit" class="btn btn-primary" id="pg-send" ${totalModels === 0 ? 'disabled' : ''}>Send</button>
          <button type="button" class="btn btn-danger" id="pg-stop" style="display:none" onclick="stopMessage()">Stop</button>
        </form>
      </div>

      <aside class="pg-settings" id="pg-settings">
        <h3>⚙︎ Settings</h3>
        <div class="pg-settings-body">
          <div class="form-group">
            <label>System prompt</label>
            <textarea id="s-system" rows="3" placeholder="Optional — prepended to every request"></textarea>
          </div>
          <div class="form-group">
            <label>Temperature <span class="pg-val" id="v-temp">0.7</span></label>
            <input type="range" id="s-temp" min="0" max="2" step="0.1" value="0.7" oninput="document.getElementById('v-temp').textContent=this.value">
          </div>
          <div class="form-group">
            <label>Max tokens</label>
            <input type="number" id="s-maxtok" min="1" max="32000" value="1024">
          </div>
          <div class="form-group">
            <label>Top P</label>
            <input type="number" id="s-topp" min="0.01" max="1" step="0.01" value="1">
          </div>
          <label class="pg-check">
            <input type="checkbox" id="s-stream" checked>
            <span>Stream response</span>
          </label>
          <div class="pg-note">
            These settings apply to the next message you send. Numeric values are clamped server-side.
          </div>
        </div>
      </aside>
    </div>

    <style>
      .pg-grid{display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start}
      .pg-chat-card{background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius);display:flex;flex-direction:column;height:calc(100vh - 220px);min-height:420px;overflow:hidden}
      .pg-toolbar{display:flex;align-items:flex-end;gap:12px;padding:16px;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap}
      .pg-model-group{flex:1;min-width:200px}
      .pg-toolbar-right{display:flex;align-items:center;gap:10px}
      .pg-meta{font-size:11px;color:var(--text-muted);font-family:'SF Mono',Consolas,monospace;white-space:nowrap}
      .pg-messages{flex:1;min-height:0;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px}
      .pg-empty{margin:auto;text-align:center;color:var(--text-muted);font-size:13px;line-height:1.8}
      .pg-empty-icon{font-size:32px;margin-bottom:8px;opacity:0.5}
      .pg-empty-hint{font-size:12px;margin-top:6px}
      .pg-msg{max-width:85%;padding:12px 16px;border-radius:14px;font-size:13px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
      .pg-msg.user{align-self:flex-end;background:linear-gradient(135deg,rgba(59,130,246,0.18),rgba(139,92,246,0.18));border:1px solid rgba(59,130,246,0.25);color:var(--text-primary)}
      .pg-msg.assistant{align-self:flex-start;background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);color:var(--text-primary)}
      .pg-msg.error{align-self:flex-start;background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);color:var(--accent-rose);font-size:12px}
      .pg-msg-meta{font-size:10px;color:var(--text-muted);margin-top:8px;font-family:'SF Mono',Consolas,monospace}
      .pg-caret{display:inline-block;width:7px;height:14px;background:var(--accent-blue);vertical-align:text-bottom;animation:pg-blink 1s steps(2,start) infinite}
      @keyframes pg-blink{to{visibility:hidden}}
      .pg-composer{display:flex;gap:10px;padding:16px;border-top:1px solid var(--border-subtle);align-items:flex-end}
      .pg-composer textarea{flex:1;padding:11px 14px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:10px;color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;resize:none;max-height:160px;line-height:1.5;transition:var(--transition)}
      .pg-composer textarea:focus{border-color:var(--border-active);box-shadow:0 0 0 3px rgba(59,130,246,0.08)}
      .pg-composer textarea::placeholder{color:var(--text-muted)}
      .pg-settings{background:var(--bg-card);backdrop-filter:blur(12px);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:20px;position:sticky;top:20px}
      .pg-settings h3{font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:16px}
      .pg-settings-body{display:flex;flex-direction:column;gap:16px}
      .pg-settings input[type=range]{width:100%;accent-color:var(--accent-blue);cursor:pointer}
      .pg-val{color:var(--accent-blue);font-family:'SF Mono',Consolas,monospace;text-transform:none;letter-spacing:0}
      .pg-check{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--text-secondary);cursor:pointer}
      .pg-check input{accent-color:var(--accent-green);width:15px;height:15px;cursor:pointer}
      .pg-note{font-size:11px;color:var(--text-muted);line-height:1.6;padding-top:4px;border-top:1px solid var(--border-subtle)}
      .pg-settings.collapsed .pg-settings-body{display:none}
      @media(max-width:768px){
        .pg-grid{grid-template-columns:1fr;gap:14px}
        .pg-chat-card{height:auto;min-height:0}
        .pg-messages{height:52vh;min-height:220px}
        .pg-settings{position:static}
        .pg-msg{max-width:92%}
      }
    </style>

    <script>
    // NB: not named "history" — that collides with the read-only window.history,
    // so history.push() throws and every send silently dies.
    var convo = [];   // [{role, content}] — the conversation we resend each turn
    var controller = null;

    function showToast(message, type) {
      var existing = document.querySelector('.toast');
      if (existing) existing.remove();
      var t = document.createElement('div');
      t.className = 'toast';
      var ok = type !== 'error';
      t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:500;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.4);' +
        (ok ? 'background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3)'
            : 'background:rgba(244,63,94,0.15);color:#f43f5e;border:1px solid rgba(244,63,94,0.3)');
      t.textContent = message;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 2500);
    }

    document.getElementById('settings-toggle').addEventListener('click', function () {
      document.getElementById('pg-settings').classList.toggle('collapsed');
    });

    document.getElementById('clear-btn').addEventListener('click', function () {
      convo = [];
      document.getElementById('pg-messages').innerHTML = '';
      var msgs = document.getElementById('pg-messages');
      var empty = document.createElement('div');
      empty.className = 'pg-empty';
      empty.id = 'pg-empty';
      var icon = document.createElement('div'); icon.className = 'pg-empty-icon'; icon.textContent = '💬';
      var line1 = document.createElement('div'); line1.textContent = 'Pick a model and send your first message.';
      var line2 = document.createElement('div'); line2.className = 'pg-empty-hint';
      line2.textContent = 'Switch on Stream in Settings to watch tokens arrive live.';
      empty.appendChild(icon); empty.appendChild(line1); empty.appendChild(line2);
      msgs.appendChild(empty);
    });

    // Auto-grow the textarea, capped by the CSS max-height
    var input = document.getElementById('pg-input');
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(160, this.scrollHeight) + 'px';
    });
    // Enter sends, Shift+Enter inserts a newline
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.form.requestSubmit(); }
    });

    function clearEmptyState() {
      var empty = document.getElementById('pg-empty');
      if (empty) empty.remove();
    }

    // All model output goes through textContent — no innerHTML, no markdown
    // parser, so a reply can never inject markup into the admin page.
    function addMessage(role, text, meta) {
      clearEmptyState();
      var wrap = document.createElement('div');
      wrap.className = 'pg-msg ' + role;
      var body = document.createElement('div');
      body.textContent = text;
      wrap.appendChild(body);
      var metaEl = null;
      if (meta !== undefined) {
        metaEl = document.createElement('div');
        metaEl.className = 'pg-msg-meta';
        metaEl.textContent = meta || '';
        wrap.appendChild(metaEl);
      }
      document.getElementById('pg-messages').appendChild(wrap);
      scrollToBottom();
      return { wrap: wrap, body: body, meta: metaEl };
    }

    function scrollToBottom() {
      var box = document.getElementById('pg-messages');
      box.scrollTop = box.scrollHeight;
    }

    function setBusy(busy) {
      document.getElementById('pg-send').style.display = busy ? 'none' : '';
      document.getElementById('pg-stop').style.display = busy ? '' : 'none';
      document.getElementById('pg-model').disabled = busy;
    }

    function stopMessage() {
      if (controller) controller.abort();
    }

    function readSettings() {
      var topp = parseFloat(document.getElementById('s-topp').value);
      return {
        system: document.getElementById('s-system').value,
        temperature: parseFloat(document.getElementById('s-temp').value),
        max_tokens: parseInt(document.getElementById('s-maxtok').value, 10),
        top_p: isNaN(topp) ? 1 : topp,
        stream: document.getElementById('s-stream').checked
      };
    }

    async function sendMessage(event) {
      if (event) event.preventDefault();
      var box = document.getElementById('pg-input');
      var text = box.value.trim();
      var model = document.getElementById('pg-model').value;
      if (!text || !model) return;

      box.value = '';
      box.style.height = 'auto';
      addMessage('user', text);
      convo.push({ role: 'user', content: text });

      var s = readSettings();
      var started = Date.now();
      var reply = addMessage('assistant', '', '');
      var caret = document.createElement('span');
      caret.className = 'pg-caret';
      reply.body.appendChild(caret);

      setBusy(true);
      controller = new AbortController();

      try {
        var res = await fetch('/admin/playground/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: model,
            messages: convo,
            system: s.system,
            temperature: s.temperature,
            max_tokens: s.max_tokens,
            top_p: s.top_p,
            stream: s.stream
          })
        });

        if (s.stream && res.ok && res.body) {
          await consumeStream(res, reply, caret, started);
        } else {
          var data = await res.json().catch(function () { return null; });
          caret.remove();
          if (!data || !data.ok) {
            var msg = (data && data.error) || ('HTTP ' + res.status);
            reply.wrap.className = 'pg-msg error';
            reply.body.textContent = msg;
            reply.meta.textContent = '';
            convo.pop(); // the turn never completed — don't resend it
            showToast('Request failed', 'error');
            return;
          }
          reply.body.textContent = data.reply || '(empty reply)';
          reply.meta.textContent = describeUsage(data.usage, Date.now() - started, data.provider);
          convo.push({ role: 'assistant', content: data.reply || '' });
        }
      } catch (e) {
        caret.remove();
        if (e.name === 'AbortError') {
          // Keep whatever streamed in before Stop was pressed
          reply.meta.textContent = (reply.meta.textContent ? reply.meta.textContent + ' · ' : '') + 'stopped';
          if (reply.body.textContent) convo.push({ role: 'assistant', content: reply.body.textContent });
        } else {
          reply.wrap.className = 'pg-msg error';
          reply.body.textContent = e.message || 'Request failed';
          convo.pop();
        }
      } finally {
        controller = null;
        setBusy(false);
        scrollToBottom();
      }
    }

    async function consumeStream(res, reply, caret, started) {
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var accumulated = '';
      var usage = null;
      var provider = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        // Parse line by line and keep the trailing partial line. This handles
        // both \\n and \\r\\n framing without needing to split whole SSE events.
        var lines = buffer.split('\\n');
        buffer = lines.pop();

        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].replace(/\\r$/, '').trim();
          if (line.indexOf('data:') !== 0) continue;
          var payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          var json;
          try { json = JSON.parse(payload); } catch (e) { continue; }

          if (json.usage) usage = json.usage;
          if (json.provider) provider = json.provider;
          // Some proxies wrap the chunk — unwrap a single-element array too
          var choice = Array.isArray(json) ? json[0] && json[0].choices && json[0].choices[0]
                                            : json.choices && json.choices[0];
          if (!choice) continue;
          var delta = choice.delta ? choice.delta.content : null;
          if (typeof delta === 'string' && delta.length > 0) {
            accumulated += delta;
            reply.body.textContent = accumulated; // textContent, never innerHTML
            scrollToBottom();
          }
        }
      }

      caret.remove();
      if (!accumulated) {
        reply.body.textContent = '(empty reply)';
      }
      reply.meta.textContent = describeUsage(usage, Date.now() - started, provider, accumulated);
      convo.push({ role: 'assistant', content: accumulated });
    }

    function describeUsage(usage, elapsed, provider, text) {
      var parts = [];
      if (provider) parts.push(provider);
      if (usage && usage.total_tokens) parts.push(usage.total_tokens + ' tokens');
      else if (usage && usage.completion_tokens) parts.push(usage.completion_tokens + ' tokens');
      else if (text) parts.push('~' + Math.ceil(text.length / 4) + ' tokens (est.)');
      parts.push(elapsed + ' ms');
      return parts.join(' · ');
    }
    </script>
  `;

  return new Response(adminLayout("Playground", "playground", content), {
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
  let disabledModels;
  try { disabledModels = new Set(JSON.parse(p.disabled_models || "[]")); } catch { disabledModels = new Set(); }
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
        const isHidden = disabledModels.has(rawId);
        return `<div class="model-row" id="model-row-${idx}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border-subtle);transition:var(--transition)${isHidden ? ';opacity:0.55' : ''}">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);font-family:'SF Mono',Consolas,monospace;margin-bottom:4px;word-break:break-all">${fullId}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${contextWindow ? `<span class="badge badge-slate" style="font-size:10px">${(contextWindow/1000).toFixed(0)}k ctx</span>` : ''}
              ${capBadges.join('')}
              <span id="hidden-badge-${idx}" class="badge badge-amber" style="font-size:10px;${isHidden ? '' : 'display:none'}">Hidden from /models</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span id="model-status-${idx}" style="font-size:14px;width:20px;text-align:center"></span>
            <label class="toggle toggle-sm" title="${isHidden ? 'Hidden from /models — click to show' : 'Visible at /models — click to hide'}">
              <input type="checkbox" data-idx="${idx}" ${isHidden ? '' : 'checked'} onchange='toggleModelVisibility(${p.id}, ${JSON.stringify(rawId)}, this)'>
              <span class="slider"></span>
            </label>
            <button type="button" class="btn-icon" onclick="copyModelId('${fullId}', this)" title="Copy model ID">📋</button>
            <button type="button" class="btn-icon fetch" onclick="testSingleModel(${p.id}, '${rawId}', ${idx})" title="Test model" id="test-btn-${idx}">▶</button>
          </div>
        </div>`;
      }).join("")
    : '<span style="color:var(--text-muted);font-size:12px;padding:12px 0;display:block;grid-column:1/-1">No models fetched yet. Click "Fetch Models" to discover available models.</span>';

  // The model auto-fetch that runs right after a provider is added can fail
  // (bad key, quota, region block, ...). Surface the provider's own message.
  const modelsError = url?.searchParams?.get("models_error") || "";
  const modelsErrorBanner = modelsError ? `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:14px 18px;border-radius:12px;background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.3);margin-bottom:20px">
      <span style="font-size:16px;line-height:1.2">⚠️</span>
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--accent-rose);margin-bottom:4px">Could not fetch models from this provider</div>
        <div style="font-size:12px;color:var(--text-secondary);font-family:'SF Mono',Consolas,monospace;word-break:break-word">${escapeHtml(modelsError)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">The provider was saved. Fix the cause above, then use ↻ Fetch Models to retry.</div>
      </div>
    </div>` : "";

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

    ${modelsErrorBanner}

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

    // ── Model visibility (hide/show at /models) ──
    // Hides the model from the public /models listing only. Direct calls to the
    // model ID keep routing exactly as before.
    async function toggleModelVisibility(providerId, modelId, checkbox) {
      const wanted = checkbox.checked;
      const status = document.getElementById('model-status-' + checkbox.dataset.idx);
      const row = document.getElementById('model-row-' + checkbox.dataset.idx);
      const badge = document.getElementById('hidden-badge-' + checkbox.dataset.idx);
      checkbox.disabled = true;
      if (status) status.textContent = '⏳';
      try {
        const res = await fetch('/admin/models/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider_id: providerId, model_id: modelId, enabled: wanted })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
        const hidden = data.disabled === true;
        // Server is the source of truth — reflect what it actually stored
        checkbox.checked = !hidden;
        if (row) row.style.opacity = hidden ? '0.55' : '1';
        if (badge) badge.style.display = hidden ? '' : 'none';
        const label = checkbox.closest('label');
        if (label) label.title = hidden ? 'Hidden from /models — click to show' : 'Visible at /models — click to hide';
        if (status) status.textContent = hidden ? '🙈' : '👁️';
        showToast(hidden ? 'Hidden from /models' : 'Visible at /models', 'success');
      } catch (e) {
        checkbox.checked = !wanted; // revert the optimistic flip
        if (status) status.textContent = '⚠️';
        showToast('Failed: ' + e.message, 'error');
      } finally {
        checkbox.disabled = false;
      }
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
