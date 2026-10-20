# CFRouter — Puerta de enlace de IA compatible con OpenAI, router LLM y balanceador de carga para Cloudflare Workers

> **Enruta, proxifica, balancea la carga y gestiona múltiples proveedores de IA a través de un único endpoint compatible con OpenAI — una puerta de enlace LLM autoalojada, desplegada en la red edge de Cloudflare en minutos.**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120.svg)](https://workers.cloudflare.com)
[![Docs](https://img.shields.io/badge/docs-English-blue.svg)](README.md)
[![Docs FA](https://img.shields.io/badge/docs-فارسی-green.svg)](README.fa.md)
[![Docs FR](https://img.shields.io/badge/docs-Français-purple.svg)](README.fr.md)
[![Docs AR](https://img.shields.io/badge/docs-العربية-orange.svg)](README.ar.md)
[![Docs ES](https://img.shields.io/badge/docs-Español-red.svg)](README.es.md)
[![Contact](https://img.shields.io/badge/contact-info%40barivan.com-0b7285.svg)](mailto:info@barivan.com)

**Leer en:** [English](README.md) · [فارسی](README.fa.md) · [Français](README.fr.md) · [العربية](README.ar.md) · [Español](README.es.md)

> 🌍 **Esta documentación existe en cinco idiomas.** El inglés es la versión canónica y siempre
> refleja la última versión publicada; las traducciones al español, persa, francés y árabe cubren
> los mismos capítulos: instalación, referencia de API, conexión de agentes de código,
> configuración y seguridad. Si una traducción difiere del texto inglés, prevalece el inglés.

---

## 📑 Índice

| Sección | Descripción |
|---------|-------------|
| [¿Qué es CFRouter?](#qué-es-cfrouter) | Presentación del proyecto |
| [Instalación](#-instalación) | Un clic, CLI o panel — elige tu camino |
| [Inicio rápido (CLI)](#-inicio-rápido) | Opción B — para desarrolladores cómodos con la terminal |
| [Instalación desde el panel de Cloudflare](#️-instalación-desde-el-panel-de-cloudflare-sin-cli) | Opción C — despliegue solo con la interfaz web |
| [Características](#-características) | Lista completa |
| [Referencia API](#-referencia-api) | Documentación de endpoints |
| [Conectar un agente de código](#-conectar-un-agente-de-código) | Configurar Claude Code, Cline, Continue |
| [Configuración](#-configuración) | Ajustes avanzados |
| [Seguridad](#-modelo-de-seguridad) | Autenticación, secretos y buenas prácticas |
| [Desarrollo](#️-desarrollo) | Guía de desarrollo local |
| [Preguntas frecuentes](#-preguntas-frecuentes) | ¿Gratis? ¿Comparado con LiteLLM? ¿Claves? ¿Equipos? |
| [Contacto](#-contacto) | Email, issues, divulgación de seguridad |

---

## ¿Qué es CFRouter?

CFRouter es una **puerta de enlace API de IA autoalojada** construida como un único Cloudflare Worker. Actúa como **proxy inverso** y **balanceador de carga** para proveedores de LLM como OpenAI, Anthropic, Google Gemini y cualquier API compatible con OpenAI — dándote un endpoint unificado para todas tus cargas de IA.

Si construyes con **agentes de IA** (VSCode Copilot, Cline, Continue, Cursor), ejecutas **apps potenciadas por LLM** o gestionas **múltiples claves API** entre proveedores, CFRouter te ofrece una capa de enrutamiento limpia, observable y económica sobre la red edge global de Cloudflare.

Piénsalo como un router LLM autoalojado que controlas de principio a fin: ninguna puerta de terceros en el camino de la petición, ningún margen por token y tus claves de proveedor guardadas en tu propia base de datos Cloudflare D1. Es una alternativa de código abierto (MIT) a las pasarelas de IA gestionadas y a ejecutar por tu cuenta LiteLLM, OpenRouter o un proxy tipo Portkey — con failover automático, rotación de claves API, llamadas a herramientas y analítica de uso incluidas. Un solo archivo Worker, un `wrangler deploy`, y todos los modelos a los que tienes acceso responden en una única URL compatible con OpenAI.

### Para qué se usa

- **Agentes de código** — apunta Claude Code, Cline, Continue, Cursor o VS Code Copilot a una sola URL base en lugar de pegar claves de proveedor en cada herramienta.
- **Balanceo multi-proveedor** — reparte tus chat completions entre OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, Groq o tu propio servidor vLLM, con selección de clave round-robin, least-used o secuencial.
- **Supervivencia a límites de tasa y caídas** — un `429`, `401` o `5xx` de un proveedor se reintenta de forma transparente en el siguiente habilitado, así tus agentes y apps siguen funcionando.
- **Puerta de enlace de equipo** — da a cada desarrollador o app su propio token `sk-`, y observa el uso de tokens y el coste por clave y por modelo en el panel.
- **Despliegue en el edge** — un Worker, una base D1 y nada que parchear; el proxy se ejecuta dentro de la red de Cloudflare, cerca de tus usuarios.
- **Traducción de dialectos** — llama a Claude a través de la API de OpenAI, o a Gemini a través de la Messages API de Anthropic; la puerta traduce petición y respuesta en ambos sentidos, streaming incluido.

### Una puerta, cero servidores

- **Sin servidor que pagar ni parchear** — todo el router es un Worker más una base D1, y el plan
  gratuito de Cloudflare suele bastar para un equipo.
- **Un router para todos tus proyectos** — apunta todas tus apps, scripts y agentes a la misma
  puerta en vez de repartir claves de proveedor entre proyectos.
- **Tus claves, gestionadas en el centro** — las claves de proveedor viven en tu D1; reparte
  tokens `sk-` revocables por app, desarrollador o cliente, con uso seguido por token.
- **Más cuota con round-robin multi-token** — adjunta varias claves por proveedor y elige la
  estrategia `round-robin` (o `least-used`); la puerta reparte las peticiones entre ellas, y el
  límite de tasa deja de ser un techo de clave única.

### Cómo funciona

```
Tu cliente (agente, app, curl)
        │
        │  POST /v1/chat/completions   {"model": "openai/gpt-4o", ...}
        ▼
┌───────────────────────────────┐
│        CFRouter Worker        │  ← Edge de Cloudflare, cerca de tus usuarios
│  ┌─────────────────────────┐  │
│  │ Traducción de dialectos │  │  Anthropic / Gemini ←→ OpenAI
│  │ Enrutamiento (slug/…  ) │  │  proveedor elegido por slug
│  │ Selección de clave      │  │  round-robin / random / least-used / sequential
│  │ Failover automático     │  │  omite proveedores caídos, reintenta el siguiente
│  │ Seguimiento de uso      │  │  por clave, por modelo, por día
│  └─────────────────────────┘  │
└───────────┬───────────┬───────┘
            ▼           ▼
      Proveedor A   Proveedor B …   ← tus claves API, tus cuentas
            │
     Cloudflare D1 (analítica)
```

Los tres dialectos de petición (OpenAI, Anthropic, Gemini) se traducen a un
formato interno único, se enrutan al proveedor nombrado y se devuelven en
streaming en el dialecto que tu cliente espera.

---

## ✨ Características

| Característica | Descripción |
|---|---|
| **API compatible con OpenAI** | Reemplazo directo de la API de OpenAI — funciona con cualquier cliente que hable el protocolo `/v1/chat/completions` |
| **Tres dialectos API** | Messages API nativa de Anthropic en `/v1/messages`, API nativa de Gemini en `/v1beta/models/…`, más OpenAI — una puerta para todos los clientes |
| **Llamadas a herramientas** | Tool/function calling completo en los tres dialectos, con y sin streaming — lo que necesitan los agentes de código |
| **Listo para Claude Code** | `/v1/messages`, `/v1/messages/count_tokens` y auth `x-api-key` — define `ANTHROPIC_BASE_URL` y listo |
| **Balanceo multi-proveedor** | Enrutamiento `slug/modelo` entre proveedores ilimitados, cada uno con múltiples claves API |
| **4 estrategias de clave** | `round-robin`, `random`, `least-used`, `sequential` — configurable por proveedor |
| **Failover automático** | Error `401/403/429/5xx` de un proveedor → reintento transparente en el siguiente; errores terminales (`400/404/422`) fallan rápido |
| **Panel de administración** | UI web de 7 pestañas: analítica, salud, proveedores, modelos, playground, tokens, docs |
| **Catálogo de 79 proveedores** | Preajustes en un clic: labs frontera, hosts de inferencia, gateways, regionales, empresariales y de medios |
| **Playground** | Chatea con cualquier modelo desde el panel — streaming, system prompt, temperature, `max_tokens`, `top_p` |
| **Curaduría de modelos** | Oculta modelos de la lista pública `/models`, uno a uno o en masa — los ocultos siguen siendo llamables, tus clientes actuales nunca se rompen |
| **Seguimiento de uso** | Analítica de tokens por clave y modelo en Cloudflare D1 |
| **Soporte de streaming** | Streaming SSE completo con transformación transparente entre dialectos |
| **Monitoreo de salud** | Estado de salud en tiempo real de proveedores y disponibilidad de endpoints |
| **CORS habilitado** | Listo para apps de IA en navegador — cabeceras personalizadas de Anthropic, Gemini y OpenAI permitidas |
| **Limpieza de reasoning** | Campos `reasoning_content` (Qwen3 e.o.) eliminados automáticamente para clientes sensibles |
| **Despliegue cero-config** | Un solo archivo, un comando `wrangler deploy` |

---

## 💿 Instalación

Elige el camino que te encaje — los tres terminan en la misma puerta:

| Camino | Ideal para | Detalles |
|---|---|---|
| **A. Despliegue en un clic** | Lo más rápido: sin terminal ni copiar-pegar | El botón Deploy de abajo |
| [**B. Inicio rápido con CLI**](#-inicio-rápido) | Desarrolladores que viven en la terminal | Clonar + `wrangler deploy` |
| [**C. Panel, sin CLI**](#️-instalación-desde-el-panel-de-cloudflare-sin-cli) | Solo clics, con control total | Interfaz web de Cloudflare |

Los tres caminos terminan con los mismos tres pasos: **añadir un proveedor → crear un token de
puerta → apuntar tus clientes a la puerta**. Cada camino se abre abajo, uno por uno.

### Opción A: despliegue en un clic

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)

1. Pulsa **Deploy to Cloudflare** — crea el Worker y su base D1 en tu propia cuenta de
   Cloudflare.
2. Cuando se pida, define `ADMIN_PASSWORD` y `SESSION_SECRET` (o salta ambos y visita `/setup`
   en la primera apertura — el asistente los guarda por ti).
3. Desde aquí todos los caminos convergen: continúa en
   [Paso 8: Acceder al panel de administración](#paso-8-acceder-al-panel-de-administración) —
   añade un proveedor, pulsa Fetch Models, crea un token bajo **Tokens** y envía tu primera
   petición.

---

## 🚀 Inicio rápido

> **Opción B — el camino CLI.** ¿Prefieres un clic o nada de terminal? Usa la
> [opción A](#-instalación) o la
> [opción C](#️-instalación-desde-el-panel-de-cloudflare-sin-cli).

### Requisitos

- [Node.js](https://nodejs.org/) >= 18
- Una [cuenta de Cloudflare](https://dash.cloudflare.com/sign-up) (el plan gratuito sirve)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### 1. Clonar e instalar

```bash
git clone https://github.com/barivanlab/cfrouter.git
cd cfrouter
npm install
```

### 2. Crear la base D1

```bash
wrangler d1 create cfrouter-db
```

Copia el `database_id` mostrado y pégalo en `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cfrouter-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 3. Definir secretos

```bash
wrangler secret put ADMIN_PASSWORD
# Ingresa una contraseña fuerte (mín. 6 caracteres)

wrangler secret put SESSION_SECRET
# Ingresa una cadena aleatoria, mín. 16 caracteres (p. ej. openssl rand -hex 32)
```

### 4. Desplegar

```bash
wrangler deploy
```

Tu puerta está en vivo en `https://cfrouter.<your-subdomain>.workers.dev` 🎉

### 5. Configurar tu primer proveedor

1. Abre `https://cfrouter.<your-subdomain>.workers.dev/admin`
2. Inicia sesión con la contraseña definida
3. Haz clic en **+ Add Provider** (o elige un preajuste del catálogo de 79)
4. Ingresa los datos (nombre, URL base, claves API)
5. Haz clic en **Fetch Models** para descubrir los modelos disponibles
6. Bajo **Tokens**, crea un token API para tus clientes (empieza con `sk-`)

> **¿Sin CLI?** Ve a [Instalación desde el panel](#️-instalación-desde-el-panel-de-cloudflare-sin-cli) — o
> visita `/setup` en la primera apertura para definir la contraseña admin en el navegador.

---

## 🖥️ Instalación desde el panel de Cloudflare (sin CLI)

> Esta guía es para quienes prefieren desplegar entièrement desde la interfaz web de Cloudflare — sin terminal ni Wrangler CLI.

### Requisitos

- El archivo `src/index.js` de este proyecto
- Un editor de texto (Notepad, TextEdit, VSCode, etc.)

### Paso 1: Iniciar sesión en Cloudflare

1. Abre tu navegador en [dash.cloudflare.com](https://dash.cloudflare.com)
2. Inicia sesión en tu cuenta

### Paso 2: Crear una base D1

1. En la barra lateral izquierda, haz clic en **Workers & Pages**
2. Selecciona la pestaña **D1**
3. Haz clic en **Create database**
4. Ingresa un nombre (p. ej. `cfrouter-db`)
5. Haz clic en **Create**
6. ⚠️ **Importante:** Copia el **Database ID** — lo necesitarás después

### Paso 3: Crear un Worker

1. En la barra lateral izquierda, haz clic en **Workers & Pages**
2. Haz clic en **Create application**
3. Selecciona la pestaña **Workers**
4. Haz clic en **Create Worker**
5. Ingresa un nombre (p. ej. `cfrouter`)
6. Haz clic en **Deploy**

### Paso 4: Agregar el código

1. Tras crearlo, haz clic en **Edit code**
2. En el editor en línea, **elimina todo** el código por defecto
3. Pega el contenido íntegro de `src/index.js` de este proyecto
4. Haz clic en **Save and deploy**

> 💡 **Consejo:** Si aún no tienes `src/index.js`:
> - Ve a [github.com/barivanlab/cfrouter](https://github.com/barivanlab/cfrouter)
> - Haz clic en **Code** → **Download ZIP**
> - Extrae el archivo
> - Encuentra `src/index.js` dentro

### Paso 5: Conectar la base al Worker

1. En la página del Worker, ve a la pestaña **Settings**
2. Encuentra la sección **Bindings**
3. Haz clic en **Add binding**
4. Selecciona **D1 Database**
5. Completa:
   - **Variable name:** `DB`
   - **D1 database:** la base creada en el paso 2 (`cfrouter-db`)
6. Haz clic en **Deploy**

### Paso 6: Definir variables de entorno (secretos)

1. Aún en la página del Worker, pestaña **Settings**
2. Encuentra la sección **Variables and Secrets**
3. Haz clic en **Add variable**

**Secreto 1 — contraseña admin:**
- **Variable name:** `ADMIN_PASSWORD`
- **Value:** una contraseña fuerte
- ✅ Marca **Encrypt** (¡importante!)
- Haz clic en **Add variable**

**Secreto 2 — clave de sesión:**
- Haz clic de nuevo en **Add variable**
- **Variable name:** `SESSION_SECRET`
- **Value:** una cadena aleatoria larga (p. ej. `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- ✅ Marca **Encrypt**
- Haz clic en **Add variable**

> 💡 **Consejo:** Para generar una cadena aleatoria usa [random.org/strings](https://www.random.org/strings/) — 32 caracteres.

> **Alternativa: asistente de configuración** — Si omites este paso, define estos valores con el asistente web en `/setup` en la primera visita.

### Paso 7: Verificar que el Worker está en vivo

1. Ve a la pestaña **Triggers** del Worker
2. Encuentra **Domains & Routes**
3. Tu Worker está disponible en una dirección como `cfrouter.your-subdomain.workers.dev`
4. Prueba abriendo en el navegador:
   ```
   https://cfrouter.your-subdomain.workers.dev/v1/health
   ```

### Paso 8: Acceder al panel de administración

1. Abre en el navegador:
   ```
   https://cfrouter.your-subdomain.workers.dev/admin
   ```
2. Inicia sesión con la contraseña del paso 6

### Paso 9: Agregar tu primer proveedor

1. Haz clic en **Providers** en la barra lateral
2. Haz clic en **+ Add Provider**
3. Completa:
   - **Name:** el que quieras (p. ej. «OpenAI»)
   - **Base URL:** la URL base del proveedor
     - OpenAI: `https://api.openai.com/v1`
     - Anthropic: `https://api.anthropic.com/v1`
     - Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
   - **API Keys:** tus claves API (una por línea)
4. Haz clic en **Fetch Models** para descubrir modelos
5. Haz clic en **Save**

### Paso 10: Crear un token API

1. Haz clic en **Tokens** en la barra lateral
2. Haz clic en **+ Create Token**
3. Ingresa un nombre (p. ej. «VSCode»)
4. Haz clic en **Create Token**
5. ⚠️ **Importante:** Copia el token **ahora** — ¡solo se muestra una vez!

### Paso 11: Probar y usar

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "¡Hola!"}]
  }'
```

> **Nota:** los IDs de modelo usan el formato `slug/modelo` (ver [Formato de IDs](#formato-de-ids-de-modelo)).
> `gpt-4o` solo se difunde a todos los proveedores; `openai/gpt-4o` va solo a OpenAI.

---

### 📋 Referencia rápida — pasos de instalación con panel

| Paso | Acción |
|------|--------|
| 1 | Iniciar sesión en [dash.cloudflare.com](https://dash.cloudflare.com) |
| 2 | Crear base D1 → copiar Database ID |
| 3 | Crear un nuevo Worker |
| 4 | Pegar el código `src/index.js` en el editor en línea |
| 5 | Conectar D1 al Worker (Binding: `DB`) |
| 6 | Definir `ADMIN_PASSWORD` y `SESSION_SECRET` |
| 7 | Verificar que el Worker está en vivo |
| 8 | Acceder al panel en `/admin` |
| 9 | Agregar un proveedor |
| 10 | Crear un token API |
| 11 | Usar la API |

### ⚠️ Notas importantes

1. **No olvides tu contraseña** — si la pierdes tendrás que eliminar y recrear el Worker
2. **Copia tu token** — el token API solo se muestra una vez
3. **Guarda tu Database ID** — lo necesitarás para depurar
4. **Marca siempre Encrypt** — para todos los secretos
5. **Redespliega tras cambios** — después de modificar Settings

---

## 📖 Referencia API

### URL base

```
https://cfrouter.<your-subdomain>.workers.dev
```

### Autenticación

Envía tu clave API de la puerta en la cabecera que use tu cliente. Las tres se aceptan:

| Cabecera | Usada por |
|---|---|
| `Authorization: Bearer YOUR_API_KEY` | SDKs de OpenAI, Cline, Continue, la mayoría de herramientas |
| `x-api-key: YOUR_API_KEY` | SDKs de Anthropic, Claude Code |
| `x-goog-api-key` / `?key=` | SDKs de Gemini |

La clave debe ser un token de puerta creado bajo **Tokens** (empieza con `sk-`) — no una clave de proveedor.

### Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/v1/models` | token | Listar todos los modelos (IDs `slug/modelo`) |
| `POST` | `/v1/chat/completions` | token | Chat completion (formato OpenAI, streaming incluido) |
| `POST` | `/v1/messages` | token | Messages API de Anthropic (streaming + herramientas) |
| `POST` | `/v1/messages/count_tokens` | token | Conteo de tokens, respondido localmente |
| `POST` | `/v1beta/models/{model}:generateContent` | token | Formato Gemini |
| `POST` | `/v1beta/models/{model}:streamGenerateContent` | token | Formato Gemini, streaming |
| `GET` | `/v1/health` | ninguna | Chequeo público de salud (sin token) |
| `GET` | `/` · `/v1` | ninguna | Info de la puerta (endpoints, hora) |
| `GET` | `/docs` | ninguna | Documentación API interactiva |
| `GET` | `/admin` | contraseña | Panel de administración |
| *any* | *otras rutas* | token | Reenviadas tal cual al proveedor enrutado (p. ej. `/v1/embeddings`) |

Los tres dialectos se traducen al formato OpenAI y se enrutan al proveedor
nombrado: una puerta sirve a todos tus clientes. Las rutas no listadas (p. ej.
`/v1/embeddings`) se reenvían sin cambios al proveedor seleccionado.

### Formato de IDs de modelo

Los modelos se direccionan como `slug-proveedor/nombre-modelo`:

```
openai/gpt-4o
anthropic/claude-sonnet-4-20250514
my-proxy/llama-3-8b
```

El slug es el **slug** del proveedor en el panel (defecto: nombre en minúsculas
con guiones). Todo lo que sigue a la primera barra se pasa sin cambios, así que
los IDs de origen con barras también funcionan:

```
openrouter/meta-llama/llama-3.1-70b-instruct
```

Notas de comportamiento:

- Un `slug/modelo` cuyo slug no coincide con ningún proveedor devuelve `404` con
  la lista de slugs existentes — salvo que un proveedor anuncie realmente ese nombre con barra.
- Un nombre sin barra se **difunde a todos los proveedores habilitados** en
  round-robin; el primer éxito gana. Prefiere `slug/modelo` para un enrutamiento predecible.

### Llamadas a herramientas

El tool use funciona en los tres dialectos, con y sin streaming. Esto es lo que
hace la puerta utilizable por agentes de código — Claude Code y Cline pilotan
cada edición de archivo y comando shell vía tool calls.

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

### Ejemplo: chat completion

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "¡Hola!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### Ejemplo: streaming

```bash
curl -N -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "stream": true,
    "messages": [{"role": "user", "content": "Cuenta hasta cinco."}]
  }'
```

### Semántica de errores

Los errores conservan el dialecto de la petición, para reintentos SDK correctos:

| Situación | Estado | Cuerpo |
|---|---|---|
| Clave de puerta inválida | `401` | estilo OpenAI (todas las rutas) |
| Slug de proveedor desconocido | `404` | dialecto de la petición + slugs válidos |
| Petición inválida en todas partes (`400/404/422`) | pasada | error de origen sin cambios |
| Rechazo en **todos** los destinos (`401/403/429/5xx`) | `400/404/429` pasados, si no `502` | dialecto de la petición, con `upstream_status` |
| Ningún proveedor habilitado | `503` | dialecto de la petición |

Timeout de origen: 120 s por destino.

---

## 🤖 Conectar un agente de código

Apunta tu agente a la puerta en vez de al proveedor. Necesitas tres cosas, todas
del panel:

1. **Base URL** — `https://cfrouter.<your-subdomain>.workers.dev/v1`
2. **API key** — creada bajo **Tokens** (empieza con `sk-`)
3. **Model** — `slug/modelo`, p. ej. `openai/gpt-4o`

Cada petición se enruta al proveedor nombrado. Si un proveedor cae o su clave es
rechazada, la puerta reintenta en otro habilitado antes de rendirse.

### Claude Code

Claude Code habla Messages API de Anthropic, servida nativamente en
`/v1/messages` — tool use incluido. Define:

```bash
export ANTHROPIC_BASE_URL="https://cfrouter.your-subdomain.workers.dev"
export ANTHROPIC_API_KEY="sk-your-gateway-token"
export ANTHROPIC_MODEL="anthropic/claude-sonnet-4-20250514"
```

`ANTHROPIC_BASE_URL` no lleva sufijo `/v1` — Claude Code añade `/v1/messages`
solo. Luego ejecuta `claude` con normalidad. Pídele leer un archivo: si la
respuesta vuelve con su contenido, el tool calling funciona de punta a punta.

> Prefiere `ANTHROPIC_API_KEY` sobre `ANTHROPIC_AUTH_TOKEN`. La primera envía la
> clave en la cabecera `x-api-key`, la segunda en `Authorization: Bearer` — la
> puerta acepta ambas, pero `x-api-key` es la cabecera que Claude Code espera usar.

### Cline

En el panel de ajustes de Cline:

| Campo | Valor |
|---|---|
| **API Provider** | OpenAI Compatible |
| **Base URL** | `https://cfrouter.your-subdomain.workers.dev/v1` |
| **API Key** | tu token de puerta `sk-...` |
| **Model ID** | `slug/modelo`, p. ej. `openai/gpt-4o` |

Cline lee `GET /v1/models` para llenar su desplegable. Todos los modelos de todos
los proveedores habilitados figuran allí como `slug/modelo`: elige o escribe a
mano. ¿Falta un modelo? Muéstralo de nuevo en **Models** del panel.

### Continue

En `~/.continue/config.json`, agrega bajo `models`:

```json
{
  "title": "CFRouter",
  "provider": "openai",
  "model": "openai/gpt-4o",
  "apiBase": "https://cfrouter.your-subdomain.workers.dev/v1",
  "apiKey": "sk-your-gateway-token"
}
```

### Cursor / SDK de OpenAI

Cualquier cliente que acepte una base URL de OpenAI funciona — base URL en
`https://cfrouter.<your-subdomain>.workers.dev/v1`, clave en tu token de puerta,
modelo en `slug/modelo`.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://cfrouter.<your-subdomain>.workers.dev/v1",
    api_key="sk-your-gateway-token",
)
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "¡Hola!"}],
)
print(response.choices[0].message.content)
```

### Chatbots, automatización y más (n8n, Hermes, …)

Todo lo que hable el protocolo OpenAI funciona igual — sin infraestructura extra:

- **n8n** — en un nodo OpenAI (o HTTP Request), pon la base URL en
  `https://cfrouter.<your-subdomain>.workers.dev/v1` (o tu
  [dominio personalizado](#dominio-personalizado-opcional)), la credencial en tu token `sk-` y
  el modelo en `slug/modelo`.
- **Chatbots y agentes estilo Hermes** — donde la herramienta pida base URL de OpenAI, API key y
  modelo, pega los mismos tres valores. Streaming y tool calling se comportan como OpenAI, así
  tus asistentes siguen funcionando sin cambios.
- Una sola puerta sirve a la vez a agentes de código, chatbots y automatizaciones — cada uno con
  su token, todos medidos en el mismo panel.

### Solución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| `401 Invalid API key` | Clave ausente o no es token de puerta | Usa un token de **puerta** de **Tokens** (empieza con `sk-`), no una clave de proveedor |
| `404 Unknown provider slug` | Slug sin proveedor | El error lista los slugs válidos — ver pestaña **Providers** |
| Agente colgado, sin salida | Respuesta streaming incompleta | Verifica Base URL y token del proveedor — pruébalo vía **Playground** |
| Desplegable de modelos vacío | `/models` del proveedor inalcanzable desde el Worker | Repliegue a la lista cacheada de **Fetch Models**; re-ejecútala en Providers |
| `503 No providers available` | Ningún proveedor habilitado | Habilita uno en **Providers** |

---

## 🔧 Configuración

### Variables de entorno (secretos)

| Secreto | Requerido | Descripción |
|---|---|---|
| `ADMIN_PASSWORD` | sí (o `/setup`) | Contraseña del panel (mín. 6 car.) |
| `SESSION_SECRET` | sí (o `/setup`) | Clave de firma de sesión (mín. 16 car., hex aleatorio recomendado) |

Vía `wrangler secret put ADMIN_PASSWORD` / `SESSION_SECRET`, u omite ambos y visita
`/setup` en la primera apertura — el asistente los guarda.

### Ajustes wrangler.toml

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

### Estrategias de clave (por proveedor)

Cada proveedor elige una estrategia de rotación de sus claves API:

| Estrategia | Comportamiento |
|---|---|
| `round-robin` (defecto) | Claves usadas por turnos — carga repartida |
| `random` | Sorteo uniforme por petición |
| `least-used` | Clave con menor contador de llamadas (seguido en D1) |
| `sequential` | Siempre la primera clave habilitada — predecible, ideal en primario/respaldo |

Cámbiala en la página detalle del proveedor; aplica a peticiones OpenAI,
Anthropic y Gemini por igual.

### Dominio personalizado (opcional)

Dale a tu puerta tu propia dirección — y entrega esa dirección a tus clientes. El propio
enrutamiento de Cloudflare pone tu dominio delante del Worker: los clientes lo usan como base
URL exactamente igual que la dirección `*.workers.dev` por defecto (el TLS se provisiona
automáticamente).

**Vía el panel de Cloudflare (sin archivo de config):**

1. Abre la página de tu Worker → **Settings → Domains & Routes → Add → Custom Domain**
2. Escribe p. ej. `api.yourdomain.com` (la zona debe estar en Cloudflare)
3. Usa `https://api.yourdomain.com/v1` como base URL en cada lugar donde usarías la URL
   `workers.dev`

**Vía `wrangler.toml` (una ruta en una zona tuya):**

```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

Luego `wrangler deploy` — las peticiones a `https://api.yourdomain.com/*` ya llegan a este
Worker.

**Servir a tus clientes en tu dominio:** crea un token de puerta por cliente bajo **Tokens**
(empieza con `sk-`) y entrega a cada uno las mismas dos cosas — la URL base de tu dominio y su
token. El uso queda separado por token en la pestaña de analíticas: un solo Worker en tu dominio
sirve a todos tus proyectos y clientes, con observabilidad por cliente y sin infraestructura
extra.

### Modelo de datos (D1)

La puerta crea sus tablas en la primera petición — sin migraciones manuales:

| Tabla | Uso |
|---|---|
| `custom_providers` | Proveedores: nombre, slug, URL, claves, estrategia, modelos en caché |
| `api_keys` | Tokens de puerta (hash SHA-256 + prefijo, nunca la clave cruda) |
| `token_usage` | Contadores de llamadas por clave (motor de `least-used`) |
| `usage_summary` | Uso diario por token y modelo (analítica) |
| `api_status` | Estado de salud de proveedores |
| `app_settings` | Hash de contraseña admin, estado del setup |

---

## 🔒 Modelo de seguridad

- **Tokens de puerta** guardados como hash SHA-256 — el token crudo solo se muestra
  una vez al crearlo. Solo el prefijo `sk-` se conserva para identificación.
- **Claves de proveedor** en D1 (almacenamiento edge de Cloudflare); secretos admin
  (`ADMIN_PASSWORD`, `SESSION_SECRET`) como secretos Worker cifrados.
- **Sesiones**: cookies firmadas HMAC (expiración 24 h). HTML admin con `Cache-Control: no-store`.
- **Failover seguro por diseño:** solo los errores terminales fallan rápido; los
  errores de credencial/cuota/caída reintentan en el siguiente proveedor.
- **Buenas prácticas:** `least-used` o `round-robin` para no martillar una clave,
  rotación periódica de claves, un token de puerta por cliente para una analítica
  significativa, y nunca un `wrangler.toml` con un `database_id` real en un fork
  público ajeno.

---

## 🏗️ Arquitectura

Worker monofichero (`src/index.js`, ~6.600 líneas) — UI admin HTML, enrutamiento y
traducción de dialectos en una unidad desplegable:

```
cfrouter/
├── src/
│   └── index.js          # La puerta entera (rutas, UI, traducción)
├── wrangler.toml          # Config del Worker + binding D1
├── package.json
├── .github/
│   └── workflows/
│       └── ci.yml         # Pipeline de validación + despliegue
├── README.md              # Docs en inglés
├── README.fa.md           # Docs en persa
├── README.fr.md           # Docs en francés
├── README.ar.md           # Docs en árabe
├── README.es.md           # Docs en español (este archivo)
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## 🛠️ Desarrollo

```bash
# Servidor dev local
npm run dev

# Despliegue a producción
npm run deploy

# Logs en vivo
npm run tail
```

### D1 local

```bash
wrangler d1 create cfrouter-db --local
# pega el id en wrangler.toml, luego:
npm run dev
```

Panel admin: `http://localhost:8787/admin` · Salud: `http://localhost:8787/v1/health`

---

## 🤝 Contribuir

¡Contribuciones bienvenidas! Ver [CONTRIBUTING.md](CONTRIBUTING.md).
Por favor lee el [Código de conducta](CODE_OF_CONDUCT.md) antes de participar — las correcciones de traducción y los nuevos README de idioma valen tanto como el código.
¿Tienes dudas antes de empezar? Escribe a [info@barivan.com](mailto:info@barivan.com).

---

## 📄 Licencia

Licencia MIT — ver [LICENSE](LICENSE).

---

## 🔗 Proyectos relacionados

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Anthropic API](https://docs.anthropic.com/en/api/messages)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) · [Cline](https://github.com/cline/cline) · [Continue](https://github.com/continuedev/continue)

---

## ❓ Preguntas frecuentes

**¿CFRouter es gratis?**
Sí. CFRouter es código abierto bajo licencia MIT y se ejecuta en tu propia cuenta de Cloudflare: pagas Cloudflare (el plan gratuito suele bastar para un equipo) más las facturas de tus proveedores. Sin margen por petición, sin suscripción y sin ningún servicio de terceros en el camino de tus peticiones.

**¿En qué se diferencia de LiteLLM, OpenRouter o Portkey?**
CFRouter es un único Cloudflare Worker con su propia base de datos D1: nada que alojar, ningún servicio Python ni contenedor que parchear, ninguna cuenta de proveedor intermedia entre tú y tus APIs. Obtienes un router compatible con OpenAI dentro de tu cuenta de Cloudflare, con rotación de claves round-robin, failover automático, un catálogo de 79 proveedores y un panel de administración para la analítica de uso.

**¿Puedo usarlo con Claude Code, Cline, Continue, Cursor o VS Code Copilot?**
Ese es el caso de uso principal. Claude Code habla la Messages API nativa de Anthropic en `/v1/messages`; el resto de agentes compatibles con OpenAI se conectan a `/v1` con un token de la puerta. Las llamadas a herramientas (function calling) funcionan en los tres dialectos, con y sin streaming — lo que necesitan los agentes de código para cada edición de archivo y cada comando de shell.

**¿Funciona con proveedores distintos de OpenAI, Anthropic y Gemini?**
Cualquier endpoint compatible con OpenAI: OpenRouter, Groq, DeepSeek, Together, Fireworks, Cloudflare Workers AI, Azure OpenAI, Snowflake Cortex, Modal o un servidor Ollama / vLLM autoalojado. El panel incluye 79 presets y puedes añadir un proveedor propio con la URL base, el estilo de cabecera y las credenciales acompañantes que necesite.

**¿Dónde viven mis claves API y mi tráfico?**
En tu cuenta de Cloudflare. Las claves de proveedor están en tu base D1, los tokens de la puerta se guardan como hashes SHA-256 (el token en claro se muestra una sola vez) y las credenciales de admin son secretos cifrados del Worker. Las peticiones van de tu cliente a tu proveedor a través de tu Worker — ningún tráfico ni clave pasa por un servidor que controlemos.

**¿Puedo ejecutarlo para un equipo o varias apps?**
Sí. Crea un token de puerta por cliente en **Tokens**, elige una estrategia de clave por proveedor (`round-robin`, `random`, `least-used`, `sequential`) y consulta la pestaña de analítica para ver el uso por clave y por modelo — útil para repercutir costes, detectar un agente desbocado y saber qué proveedor sirve realmente tu tráfico.

**¿Qué pasa si un proveedor cae o alcanza su límite de tasa?**
Las peticiones que nombran un proveedor caído se reintentan de forma transparente en el siguiente habilitado; solo los errores terminales (`400`, `404`, `422`) fallan rápido. Una petición sin proveedor nombrado se difunde en round-robin y se queda con la primera respuesta correcta.

**¿Soporta streaming?**
Sí — streaming SSE completo en los dialectos OpenAI, Anthropic y Gemini, con traducción de respuestas entre formatos sobre la marcha, incluidas las llamadas a herramientas en streaming.

**¿Puedo usarlo con chatbots, n8n o agentes estilo Hermes?**
Sí — todo lo que hable el protocolo OpenAI se conecta con los mismos tres valores (base URL,
token `sk-`, `slug/modelo`). Una sola puerta sirve a la vez a agentes de código, chatbots y
automatizaciones, cada uno con su token, sin infraestructura de servidores.

**¿Puedo servir mi propio dominio (y a mis clientes) desde él?**
Sí. Pon tu dominio delante del Worker con el enrutamiento de Cloudflare y entrega a cada cliente
la URL base de tu dominio más un token de puerta (ver
[Dominio personalizado](#dominio-personalizado-opcional)). El uso queda separado por token: un
solo Worker en tu dominio sirve a todos tus proyectos y clientes.

---

## 📬 Contacto

Preguntas, informes de errores, correcciones de traducción, soporte comercial y divulgaciones de seguridad llegan todos a la misma dirección:

- **Email:** [info@barivan.com](mailto:info@barivan.com)
- **Issues y peticiones de funcionalidad:** [github.com/barivanlab/cfrouter/issues](https://github.com/barivanlab/cfrouter/issues)
- **Discusiones y dudas de uso:** [github.com/barivanlab/cfrouter/discussions](https://github.com/barivanlab/cfrouter/discussions)
- **Seguridad:** solo aviso privado — ver [SECURITY.md](SECURITY.md), nunca una issue pública
