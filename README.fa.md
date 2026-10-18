# CFRouter — درگاه هوش مصنوعی سازگار با OpenAI و متعادل‌کننده بار برای Cloudflare Workers

> **مسیریابی، پروکسی و مدیریت چند ارائه‌دهنده هوش مصنوعی از طریق یک اندپوینت یکپارچه سازگار با OpenAI — استقرار روی شبکه اج کلادفلر در چند دقیقه.**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120.svg)](https://workers.cloudflare.com)

**خواندن به زبان:** [English](README.md) · [فارسی](README.fa.md) · [Français](README.fr.md) · [العربية](README.ar.md) · [Español](README.es.md)

---

## 📑 فهرست

| بخش | توضیح |
|---------|-------------|
| [CFRouter چیست؟](#cfrouter-چیست) | معرفی پروژه |
| [شروع سریع (CLI)](#-شروع-سریع) | برای توسعه‌دهندگان آشنا با ترمینال |
| [نصب از داشبورد کلادفلر](#️-نصب-از-طریق-داشبورد-کلادفلر-بدون-نیاز-به-cli) | استقرار فقط با رابط وب |
| [قابلیت‌ها](#-قابلیت‌ها) | فهرست کامل قابلیت‌ها |
| [مرجع API](#-مرجع-api) | مستندات اندپوینت‌ها |
| [اتصال ایجنت کدنویسی](#-اتصال-ایجنت-کدنویسی) | راه‌اندازی Claude Code، Cline، Continue |
| [پیکربندی](#-پیکربندی) | تنظیمات پیشرفته |
| [امنیت](#-مدل-امنیتی) | احراز هویت، سکرت‌ها و بهترین روش‌ها |
| [توسعه](#️-توسعه) | راهنمای توسعه محلی |

---

## CFRouter چیست؟

CFRouter یک **درگاه API هوش مصنوعی خودمیزبان (self-hosted)** است که به‌صورت یک Cloudflare Worker واحد ساخته شده. این ابزار نقش **ریورس‌پروکسی** و **متعادل‌کننده بار** را برای ارائه‌دهندگان LLM مانند OpenAI، Anthropic، Google Gemini و هر API سازگار با OpenAI ایفا می‌کند — و یک اندپوینت یکپارچه برای همه بارهای کاری هوش مصنوعی شما فراهم می‌سازد.

اگر با **ایجنت‌های هوش مصنوعی** (VSCode Copilot، Cline، Continue، Cursor) کار می‌کنید، **اپ‌های مبتنی بر LLM** اجرا می‌کنید یا **چند کلید API** را بین ارائه‌دهندگان مختلف مدیریت می‌کنید، CFRouter یک لایه مسیریابی تمیز، قابل‌مشاهده و مقرون‌به‌صرفه روی شبکه اج جهانی کلادفلر به شما می‌دهد.

### نحوه کار

```
کلاینت شما (ایجنت، اپ، curl)
        │
        │  POST /v1/chat/completions   {"model": "openai/gpt-4o", ...}
        ▼
┌───────────────────────────────┐
│        CFRouter Worker        │  ← اج کلادفلر، نزدیک کاربران شما
│  ┌─────────────────────────┐  │
│  │ ترجمه گویش‌ها           │  │  Anthropic / Gemini ←→ OpenAI
│  │ مسیریابی (slug/model)   │  │  انتخاب ارائه‌دهنده با slug
│  │ انتخاب توکن             │  │  round-robin / random / least-used / sequential
│  │ فیlover خودکار          │  │  رد شدن از ارائه‌دهنده خراب، تلاش بعدی
│  │ رهگیری مصرف             │  │  به‌تفکیک کلید، مدل و روز
│  └─────────────────────────┘  │
└───────────┬───────────┬───────┘
            ▼           ▼
      ارائه‌دهنده A   ارائه‌دهنده B …   ← کلیدهای API و حساب‌های شما
            │
     Cloudflare D1 (تحلیل‌ها)
```

هر سه گویش درخواستی (OpenAI، Anthropic، Gemini) به یک قالب داخلی ترجمه می‌شوند،
به ارائه‌دهنده‌ای که نام برده‌اید مسیریابی می‌گردند و پاسخ با همان گویشی که
کلاینت انتظار دارد — به‌صورت استریم — برگردانده می‌شود.

---

## ✨ قابلیت‌ها

| قابلیت | توضیح |
|---|---|
| **API سازگار با OpenAI** | جایگزین مستقیم API اوپن‌ای‌آی — با هر کلاینتی که پروتکل `/v1/chat/completions` را بفهمد کار می‌کند |
| **سه گویش API** | Messages API بومی Anthropic در `/v1/messages`، API بومی Gemini در `/v1beta/models/…` به‌علاوه OpenAI — یک درگاه برای همه کلاینت‌ها |
| **Tool Calling** | فراخوانی کامل ابزار/تابع در هر سه گویش، هم استریم و هم غیراستریم — همان چیزی که ایجنت‌های کدنویسی لازم دارند |
| **آماده Claude Code** | `/v1/messages`، `/v1/messages/count_tokens` و احراز هویت `x-api-key` — فقط `ANTHROPIC_BASE_URL` را ست کنید |
| **متعادل‌سازی بار چندارائه‌دهنده‌ای** | مسیریابی `slug/model` بین بی‌نهایت ارائه‌دهنده، هر کدام با چند کلید API |
| **۴ راهبرد کلید** | `round-robin`، `random`، `least-used`، `sequential` — قابل تنظیم برای هر ارائه‌دهنده |
| **اعتبارنامه‌های همراه** | ارائه‌دهنده‌هایی که بیشتر از یک کلید می‌خواهند (`account_id`، نام resource، هدر دوم) آن را برای هر کلید می‌گیرند — round-robin بین حساب‌ها، نه یک ارائه‌دهنده برای هر حساب |
| **فیlover خودکار** | خطای `401/403/429/5xx` از یک ارائه‌دهنده ← تلاش مجدد شفاف روی ارائه‌دهنده بعدی؛ خطاهای قطعی (`400/404/422`) سریع برمی‌گردند |
| **داشبورد مدیریتی** | رابط وب ۷زبانه‌ای: تحلیل‌ها، سلامت، ارائه‌دهندگان، مدل‌ها، پلی‌گراند، توکن‌ها، مستندات |
| **کاتالوگ ۷۹ ارائه‌دهنده** | پیش‌تنظیم‌های تک‌کلیکی: لب‌های فرانتیر، هاست‌های استنتاج، درگاه‌ها، منطقه‌ای، سازمانی و رسانه‌ای |
| **پلی‌گراند** | گفتگو با هر مدل مستقیم از داشبورد — استریمینگ، system prompt، temperature، `max_tokens`، `top_p` |
| **کیوریشن مدل‌ها** | مخفی کردن مدل‌ها از فهرست عمومی `/models` تکی یا دسته‌ای — مدل‌های مخفی همچنان قابل فراخوانی‌اند و کالرهای فعلی نمی‌شکنند |
| **رهگیری مصرف** | تحلیل مصرف توکن به‌تفکیک کلید و مدل در Cloudflare D1 |
| **پشتیبانی استریمینگ** | استریمینگ کامل SSE با تبدیل شفاف پاسخ بین گویش‌ها |
| **پایش سلامت** | وضعیت سلامت بلادرنگ ارائه‌دهندگان و دسترس‌پذیری اندپوینت‌ها |
| **CORS فعال** | آماده اپ‌های هوش مصنوعی تحت مرورگر — هدرهای سفارشی Anthropic، Gemini و OpenAI مجازند |
| **حذف reasoning** | فیلدهای `reasoning_content` (مثل Qwen3) خودکار حذف می‌شوند تا کلاینت‌های حساس نشکنند |
| **استقرار بدون تنظیم** | تک‌فایل، یک دستور `wrangler deploy` |

---

## 🚀 شروع سریع

### پیش‌نیازها

- [Node.js](https://nodejs.org/) نسخه ۱۸ یا بالاتر
- یک [حساب کلادفلر](https://dash.cloudflare.com/sign-up) (پلن رایگان کافی است)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### ۱. کلون و نصب

```bash
git clone https://github.com/barivanlab/cfrouter.git
cd cfrouter
npm install
```

### ۲. ساخت دیتابیس D1

```bash
wrangler d1 create cfrouter-db
```

مقدار `database_id` خروجی را کپی و در `wrangler.toml` جایگذاری کنید:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cfrouter-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### ۳. تنظیم سکرت‌ها

```bash
wrangler secret put ADMIN_PASSWORD
# یک گذرواژه قوی وارد کنید (حداقل ۶ کاراکتر)

wrangler secret put SESSION_SECRET
# یک رشته تصادفی وارد کنید، حداقل ۱۶ کاراکتر (مثلاً openssl rand -hex 32)
```

### ۴. استقرار

```bash
wrangler deploy
```

درگاه شما روی `https://cfrouter.<your-subdomain>.workers.dev` زنده است 🎉

### ۵. تنظیم اولین ارائه‌دهنده

1. آدرس `https://cfrouter.<your-subdomain>.workers.dev/admin` را باز کنید
2. با گذرواژه‌ای که تنظیم کردید وارد شوید
3. روی **+ Add Provider** کلیک کنید (یا یک پیش‌تنظیم از کاتالوگ ۷۹تایی انتخاب کنید)
4. مشخصات ارائه‌دهنده را وارد کنید (نام، base URL، کلیدهای API)
5. روی **Fetch Models** کلیک کنید تا مدل‌های موجود کشف شوند
6. در بخش **Tokens** یک توکن API برای کلاینت‌ها بسازید (با `sk-` شروع می‌شود)

> ارائه‌دهنده‌هایی که برای هر کلید یک مقدار دوم می‌خواهند (شماره حساب کلادفلر، resource آژور، …) در [اعتبارنامه‌های همراه](#اعتبارنامههای-همراه-برای-هر-کلید) پوشش داده شده‌اند.

> **CLI ندارید؟** به بخش [نصب از داشبورد کلادفلر](#️-نصب-از-طریق-داشبورد-کلادفلر-بدون-نیاز-به-cli) بروید — یا در اولین بازدید آدرس `/setup` را باز کنید و گذرواژه مدیر را در مرورگر تنظیم کنید.

---

## 🖥️ نصب از طریق داشبورد کلادفلر (بدون نیاز به CLI)

> این راهنما برای کاربرانی است که ترجیح می‌دهند استقرار را کاملاً از طریق رابط وب کلادفلر انجام دهند — بدون ترمینال و Wrangler CLI.

### پیش‌نیازها

- فایل `src/index.js` از این پروژه
- یک ویرایشگر متن (Notepad، TextEdit، VSCode و غیره)

### گام ۱: ورود به کلادفلر

1. مرورگر را باز کنید و به [dash.cloudflare.com](https://dash.cloudflare.com) بروید
2. وارد حساب خود شوید

### گام ۲: ساخت دیتابیس D1

1. در نوار کناری چپ روی **Workers & Pages** کلیک کنید
2. زبانه **D1** را انتخاب کنید
3. روی **Create database** کلیک کنید
4. یک نام وارد کنید (مثلاً `cfrouter-db`)
5. روی **Create** کلیک کنید
6. ⚠️ **مهم:** **Database ID** را کپی کنید — بعداً لازمش دارید

### گام ۳: ساخت ورکر

1. در نوار کناری چپ روی **Workers & Pages** کلیک کنید
2. روی **Create application** کلیک کنید
3. زبانه **Workers** را انتخاب کنید
4. روی **Create Worker** کلیک کنید
5. یک نام برای ورکر وارد کنید (مثلاً `cfrouter`)
6. روی **Deploy** کلیک کنید

### گام ۴: افزودن کد

1. پس از ساخت ورکر، روی **Edit code** کلیک کنید
2. در ویرایشگر آنلاین، **تمام** کد پیش‌فرض را پاک کنید
3. کل محتوای `src/index.js` این پروژه را بچسبانید (paste)
4. روی **Save and deploy** کلیک کنید

> 💡 **نکته:** اگر هنوز `src/index.js` را ندارید:
> - به [github.com/barivanlab/cfrouter](https://github.com/barivanlab/cfrouter) بروید
> - روی **Code** ← **Download ZIP** کلیک کنید
> - فایل را از حالت فشرده خارج کنید
> - `src/index.js` را داخل آن پیدا کنید

### گام ۵: اتصال دیتابیس به ورکر

1. در صفحه ورکر به زبانه **Settings** بروید
2. بخش **Bindings** را پیدا کنید
3. روی **Add binding** کلیک کنید
4. نوع بایندینگ **D1 Database** را انتخاب کنید
5. پر کنید:
   - **Variable name:** `DB`
   - **D1 database:** دیتابیسی که در گام ۲ ساختید (`cfrouter-db`) را انتخاب کنید
6. روی **Deploy** کلیک کنید

### گام ۶: تنظیم متغیرهای محیطی (سکرت‌ها)

1. همچنان در صفحه ورکر، به زبانه **Settings** بروید
2. بخش **Variables and Secrets** را پیدا کنید
3. روی **Add variable** کلیک کنید

**سکرت ۱ — گذرواژه مدیر:**
- **Variable name:** `ADMIN_PASSWORD`
- **Value:** یک گذرواژه قوی وارد کنید
- ✅ تیک **Encrypt** را بزنید (مهم!)
- روی **Add variable** کلیک کنید

**سکرت ۲ — کلید نشست:**
- دوباره روی **Add variable** کلیک کنید
- **Variable name:** `SESSION_SECRET`
- **Value:** یک رشته تصادفی طولانی وارد کنید (مثلاً `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- ✅ تیک **Encrypt** را بزنید
- روی **Add variable** کلیک کنید

> 💡 **نکته:** برای تولید رشته تصادفی از [random.org/strings](https://www.random.org/strings/) استفاده کنید — یک رشته ۳۲کاراکتری بسازید.

> **راه جایگزین: ویزارد راه‌اندازی** — اگر این گام را رد کنید، می‌توانید این مقادیر را از طریق ویزارد تحت وب در آدرس `/setup` در اولین بازدید تنظیم کنید. ویزارد شما را قدم‌به‌قدم برای ساخت گذرواژه مدیر و سکرت نشست راهنمایی می‌کند.

### گام ۷: بررسی زنده بودن ورکر

1. در صفحه ورکر به زبانه **Triggers** بروید
2. بخش **Domains & Routes** را پیدا کنید
3. ورکر شما روی آدرسی مثل `cfrouter.your-subdomain.workers.dev` در دسترس است
4. با باز کردن این URL در مرورگر تست کنید:
   ```
   https://cfrouter.your-subdomain.workers.dev/v1/health
   ```

### گام ۸: دسترسی به پنل مدیریت

1. این URL را در مرورگر باز کنید:
   ```
   https://cfrouter.your-subdomain.workers.dev/admin
   ```
2. با گذرواژه‌ای که در گام ۶ تنظیم کردید وارد شوید

### گام ۹: افزودن اولین ارائه‌دهنده

1. در نوار کناری روی **Providers** کلیک کنید
2. روی **+ Add Provider** کلیک کنید
3. مشخصات را پر کنید:
   - **Name:** هر نامی که دوست دارید (مثلاً «OpenAI» یا «My Anthropic»)
   - **Base URL:** آدرس پایه API ارائه‌دهنده
     - OpenAI: `https://api.openai.com/v1`
     - Anthropic: `https://api.anthropic.com/v1`
     - Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
   - **API Keys:** کلیدهای API را وارد کنید (هر خط یک کلید)
4. روی **Fetch Models** کلیک کنید تا مدل‌های موجود کشف شوند
5. روی **Save** کلیک کنید

### گام ۱۰: ساخت توکن API

1. در نوار کناری روی **Tokens** کلیک کنید
2. روی **+ Create Token** کلیک کنید
3. یک نام وارد کنید (مثلاً «VSCode» یا «My App»)
4. روی **Create Token** کلیک کنید
5. ⚠️ **مهم:** توکن را **همین حالا** کپی کنید — فقط یک بار نمایش داده می‌شود!

### گام ۱۱: تست و استفاده

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "سلام!"}]
  }'
```

> **نکته:** شناسه مدل‌ها با قالب `slug/model` هستند ([قالب شناسه مدل](#قالب-شناسه-مدل)).
> `gpt-4o` به‌تنهایی به همه ارائه‌دهندگان ارسال می‌شود؛ `openai/gpt-4o` فقط به OpenAI می‌رود.

---

### 📋 مرجع سریع — گام‌های نصب با داشبورد

| گام | اقدام |
|------|--------|
| ۱ | ورود به [dash.cloudflare.com](https://dash.cloudflare.com) |
| ۲ | ساخت دیتابیس D1 ← کپی Database ID |
| ۳ | ساخت ورکر جدید |
| ۴ | چسباندن کد `src/index.js` در ویرایشگر آنلاین |
| ۵ | اتصال D1 به ورکر (Binding: `DB`) |
| ۶ | تنظیم `ADMIN_PASSWORD` و `SESSION_SECRET` |
| ۷ | بررسی زنده بودن ورکر در URL آن |
| ۸ | دسترسی به پنل مدیریت در `/admin` |
| ۹ | افزودن ارائه‌دهنده |
| ۱۰ | ساخت توکن API |
| ۱۱ | استفاده از API |

### ⚠️ نکات مهم

1. **گذرواژه را فراموش نکنید** — اگر گمش کنید باید ورکر را حذف و دوباره بسازید
2. **توکن را کپی کنید** — توکن API فقط یک بار نمایش داده می‌شود
3. **Database ID را نگه دارید** — برای عیب‌یابی لازمش دارید
4. **همیشه Encrypt را بزنید** — مطمئن شوید تیک Encrypt برای همه سکرت‌ها خورده است
5. **بعد از تغییر تنظیمات دوباره دیپلوی کنید** — پس از تغییر Settings ورکر را دوباره دیپلوی کنید

---

## 📖 مرجع API

### آدرس پایه

```
https://cfrouter.<your-subdomain>.workers.dev
```

### احراز هویت

کلید API درگاه را در هر هدری که کلاینت شما استفاده می‌کند بفرستید. هر سه پذیرفته‌اند:

| هدر | استفاده‌کنندگان |
|---|---|
| `Authorization: Bearer YOUR_API_KEY` | SDKهای OpenAI، Cline، Continue و بیشتر ابزارها |
| `x-api-key: YOUR_API_KEY` | SDKهای Anthropic و Claude Code |
| `x-goog-api-key` / `?key=` | SDKهای Gemini |

کلید باید توکن درگاهی باشد که در بخش **Tokens** داشبورد ساخته‌اید (با `sk-` شروع می‌شود) — نه کلید ارائه‌دهنده.

### اندپوینت‌ها

| متد | مسیر | احراز هویت | توضیح |
|---|---|---|---|
| `GET` | `/v1/models` | توکن | فهرست همه مدل‌های موجود (شناسه‌های `slug/model`) |
| `POST` | `/v1/chat/completions` | توکن | چت کامپلیشن (قالب OpenAI، شامل استریمینگ) |
| `POST` | `/v1/messages` | توکن | Messages API آنتروپیک (شامل استریمینگ و ابزارها) |
| `POST` | `/v1/messages/count_tokens` | توکن | شمارش توکن، به‌صورت محلی پاسخ داده می‌شود |
| `POST` | `/v1beta/models/{model}:generateContent` | توکن | قالب Gemini |
| `POST` | `/v1beta/models/{model}:streamGenerateContent` | توکن | قالب Gemini، استریمینگ |
| `GET` | `/v1/health` | بدون نیاز | بررسی سلامت عمومی (بدون توکن) |
| `GET` | `/` · `/v1` | بدون نیاز | اطلاعات درگاه (اندپوینت‌ها، زمان) |
| `GET` | `/docs` | بدون نیاز | مستندات تعاملی API |
| `GET` | `/admin` | گذرواژه | داشبورد مدیریت |
| *any* | *سایر مسیرها* | توکن | بدون تغییر به ارائه‌دهنده مسیریابی‌شده پاس داده می‌شود (مثل `/v1/embeddings`) |

هر سه گویش API به قالب OpenAI ترجمه و به ارائه‌دهنده‌ای که نام برده‌اید
مسیریابی می‌شوند؛ پس یک درگاه به همه کلاینت‌های شما سرویس می‌دهد. مسیرهایی که
بالا فهرست نشده‌اند (مثل `/v1/embeddings`) دست‌نخورده به ارائه‌دهنده منتخب
فوروارد می‌شوند.

### قالب شناسه مدل

مدل‌ها با قالب `provider-slug/model-name` آدرس‌دهی می‌شوند:

```
openai/gpt-4o
anthropic/claude-sonnet-4-20250514
my-proxy/llama-3-8b
```

اسلاگ همان **slug** ارائه‌دهنده در داشبورد است (پیش‌فرض: نام ارائه‌دهنده با حروف
کوچک و خط‌تیره). همه‌چیز بعد از اولین اسلش دست‌نخورده به آن ارائه‌دهنده پاس
داده می‌شود، پس شناسه‌های بالادستی که خودشان اسلش دارند هم کار می‌کنند:

```
openrouter/meta-llama/llama-3.1-70b-instruct
```

نکات رفتاری:

- `slug/model`ای که اسلاگ آن با هیچ ارائه‌دهنده‌ای match نشود، خطای `404` با فهرست
  اسلاگ‌های موجود برمی‌گرداند — مگر این‌که ارائه‌دهنده‌ای دقیقاً همان نام اسلش‌دار را تبلیغ کند.
- نام مدل بدون اسلش (بدون `/`) به **همه ارائه‌دهندگان فعال** به ترتیب round-robin
  ارسال می‌شود؛ اولین موفقیت برنده است. برای مسیریابی قابل‌پیش‌بینی از `slug/model` استفاده کنید.

### فراخوانی ابزار (Tool calling)

استفاده از ابزار در هر سه گویش، هم در حالت استریم و هم غیراستریم کار می‌کند.
همین ویژگی درگاه را برای ایجنت‌های کدنویسی قابل‌استفاده می‌کند — Claude Code و Cline
هر ویرایش فایل و دستور شل را از طریق tool call انجام می‌دهند.

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

### مثال: چت کامپلیشن

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "سلام!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### مثال: استریمینگ

```bash
curl -N -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "stream": true,
    "messages": [{"role": "user", "content": "تا پنج بشمر."}]
  }'
```

### معنای خطاها

خطاها با همان گویش درخواست برگردانده می‌شوند تا retryهای SDK درست رفتار کنند:

| وضعیت | کد | بدنه |
|---|---|---|
| کلید درگاه نامعتبر | `401` | سبک OpenAI (همه مسیرها) |
| اسلاگ ارائه‌دهنده ناشناس | `404` | گویش درخواست + فهرست اسلاگ‌های معتبر |
| درخواست غلط برای همه ارائه‌دهندگان (`400/404/422`) | پاس‌ترو | خطای بالادستی، دست‌نخورده |
| رد شدن توسط **همه** مقاصد (`401/403/429/5xx`) | `400/404/429` پاس‌ترو، در غیر این صورت `502` | گویش درخواست، همراه `upstream_status` |
| هیچ ارائه‌دهنده فعالی نیست | `503` | گویش درخواست |

تایم‌اوت بالادستی برای هر مقصد ۱۲۰ ثانیه است.

---

## 🤖 اتصال ایجنت کدنویسی

ایجنت را به‌جای ارائه‌دهنده، به درگاه وصل کنید. سه چیز لازم دارید، هر سه از داشبورد:

1. **Base URL** — `https://cfrouter.<your-subdomain>.workers.dev/v1`
2. **API key** — در بخش **Tokens** بسازید (با `sk-` شروع می‌شود)
3. **Model** — `slug/model`، مثلاً `openai/gpt-4o`

هر درخواست به ارائه‌دهنده‌ای که نام برده‌اید مسیریابی می‌شود. اگر ارائه‌دهنده‌ای
خراب باشد یا کلیدش رد شود، درگاه پیش از تسلیم شدن درخواست را روی ارائه‌دهنده
فعال دیگری retry می‌کند.

### Claude Code

Claude Code به Messages API آنتروپیک صحبت می‌کند که درگاه آن را به‌صورت بومی در
`/v1/messages` سرو می‌کند — با tool use. این متغیرهای محیطی را ست کنید:

```bash
export ANTHROPIC_BASE_URL="https://cfrouter.your-subdomain.workers.dev"
export ANTHROPIC_API_KEY="sk-your-gateway-token"
export ANTHROPIC_MODEL="anthropic/claude-sonnet-4-20250514"
```

`ANTHROPIC_BASE_URL` پسوند `/v1` نمی‌گیرد — خود Claude Code عبارت `/v1/messages`
را اضافه می‌کند. بعد مثل همیشه در پروژه‌تان `claude` را اجرا کنید. از آن بخواهید
یک فایل را بخواند: اگر پاسخ با محتوای فایل برگشت، tool calling سرتاسری کار می‌کند.

> `ANTHROPIC_API_KEY` را به `ANTHROPIC_AUTH_TOKEN` ترجیح دهید. اولی کلید را در هدر
> `x-api-key` می‌فرستد و دومی در `Authorization: Bearer` — درگاه هر دو را می‌پذیرد،
> اما `x-api-key` همان هدری است که Claude Code انتظار دارد استفاده کند.

### Cline

در پنل تنظیمات Cline:

| فیلد | مقدار |
|---|---|
| **API Provider** | OpenAI Compatible |
| **Base URL** | `https://cfrouter.your-subdomain.workers.dev/v1` |
| **API Key** | توکن `sk-...` درگاه شما |
| **Model ID** | `slug/model`، مثلاً `openai/gpt-4o` |

Cline فهرست مدل‌ها را از `GET /v1/models` می‌خواند تا دراپ‌داون را پر کند. همه
مدل‌های همه ارائه‌دهندگان فعال آنجا با قالب `slug/model` فهرست شده‌اند؛ می‌توانید
از فهرست انتخاب کنید یا دستی تایپ کنید. اگر مدلی لازم دارید و نیست، در داشبورد
بخش **Models** آن را از حالت مخفی خارج کنید.

### Continue

در `~/.continue/config.json` یک ورودی زیر `models` اضافه کنید:

```json
{
  "title": "CFRouter",
  "provider": "openai",
  "model": "openai/gpt-4o",
  "apiBase": "https://cfrouter.your-subdomain.workers.dev/v1",
  "apiKey": "sk-your-gateway-token"
}
```

### Cursor / OpenAI SDK

هر کلاینتی که base URL اوپن‌ای‌آی بگیرد کار می‌کند — base URL را روی
`https://cfrouter.<your-subdomain>.workers.dev/v1`، کلید API را روی توکن درگاه و
مدل را روی `slug/model` بگذارید.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://cfrouter.<your-subdomain>.workers.dev/v1",
    api_key="sk-your-gateway-token",
)
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "سلام!"}],
)
print(response.choices[0].message.content)
```

### عیب‌یابی

| علامت | علت | راه‌حل |
|---|---|---|
| `401 Invalid API key` | کلید نیست یا توکن درگاه نیست | از توکن **درگاه** بخش **Tokens** استفاده کنید (با `sk-` شروع می‌شود)، نه کلید ارائه‌دهنده |
| `404 Unknown provider slug` | اسلاگ با هیچ ارائه‌دهنده‌ای match نیست | خطا اسلاگ‌های معتبر را فهرست می‌کند — زبانه **Providers** را چک کنید |
| ایجنت هنگ می‌کند، خروجی نمی‌دهد | پاسخ استریم نمی‌تواند کامل شود | Base URL و توکن ارائه‌دهنده را بررسی کنید — با **Playground** ارائه‌دهنده را مستقیم تست کنید |
| دراپ‌داون مدل خالی است | مسیر `/models` ارائه‌دهنده از ورکر در دسترس نیست | مدل‌ها به فهرست کش‌شده **Fetch Models** برمی‌گردند؛ در زبانه Providers دوباره اجراش کنید |
| `503 No providers available` | هیچ ارائه‌دهنده فعالی نیست | در زبانه **Providers** یکی را فعال کنید |

---

## 🔧 پیکربندی

### متغیرهای محیطی (سکرت‌ها)

| سکرت | اجباری؟ | توضیح |
|---|---|---|
| `ADMIN_PASSWORD` | بله (یا `/setup`) | گذرواژه داشبورد مدیریت (حداقل ۶ کاراکتر) |
| `SESSION_SECRET` | بله (یا `/setup`) | کلید امضای نشست (حداقل ۱۶ کاراکتر، hex تصادفی توصیه می‌شود) |

با `wrangler secret put ADMIN_PASSWORD` و `wrangler secret put SESSION_SECRET` تنظیم
کنید، یا هر دو را رد کنید و در اولین بازدید به `/setup` بروید — ویزارد آن‌ها را برایتان ذخیره می‌کند.

### تنظیمات wrangler.toml

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

### راهبردهای کلید (برای هر ارائه‌دهنده)

هر ارائه‌دهنده یک راهبرد برای چرخش کلیدهای API خود انتخاب می‌کند:

| راهبرد | رفتار |
|---|---|
| `round-robin` (پیش‌فرض) | کلیدها به نوبت استفاده می‌شوند — بار یکنواخت پخش می‌شود |
| `random` | انتخاب تصادفی یکنواخت در هر درخواست |
| `least-used` | کلیدی با کمترین تعداد فراخوانی (در D1 رهگیری می‌شود) |
| `sequential` | همیشه اولین کلید فعال — قابل‌پیش‌بینی، مناسب چیدمان primary/backup |

در صفحه جزئیات ارائه‌دهنده عوضش کنید؛ روی درخواست‌های OpenAI، Anthropic و Gemini
یکسان اعمال می‌شود.

### اعتبارنامه‌های همراه (برای هر کلید)

بعضی ارائه‌دهنده‌ها **یک مقدار دوم کنار کلید API** می‌خواهند و آن مقدار برای هر کلید
فرق می‌کند — Cloudflare Workers AI شماره حساب را در مسیر URL می‌گذارد، Azure OpenAI
نام resource را در هاست و کلید را در هدر `api-key`، و Modal دو هدر می‌خواهد. CFRouter
این‌ها را به‌صورت **فیلدهای همراه روی هر کلید** نگه می‌دارد، پس یک ردیف ارائه‌دهنده
می‌تواند بین چند حساب round-robin کند، نه یک ردیف برای هر حساب.

پیش‌تنظیم‌های کاتالوگ نیاز خودشان را اعلام می‌کنند — با انتخاب هر پیش‌تنظیم، راهنمای
زیر جعبه توکن‌ها بازنویسی می‌شود و ستون‌های موردانتظار را می‌نویسد:

| پیش‌تنظیم | فیلدهای همراه |
|---|---|
| Cloudflare Workers AI | `account_id` ← مسیر URL |
| Azure OpenAI | `resource` ← هاست؛ کلید در هدر `api-key` |
| Snowflake Cortex | `account` ← هاست |
| Modal | `app` ← هاست؛ کلید در `Modal-Key` و سکرت همراه در `Modal-Secret` |
| OpenAI | `OpenAI-Organization` و `OpenAI-Project` (اختیاری) |

**ورود گروهی** — هر اعتبارنامه یک خط، جداشده با `|`، به همان ترتیبی که ارائه‌دهنده
اعلام کرده (اگر فیلدی اعلام نکرده باشد، فقط خود کلید):

```
cf-token-1 | 1a2b3c4d5e6f7890
cf-token-2 | 9f8e7d6c5b4a3210
```

خطی که تعداد ستون‌هایش درست نباشد با شماره خط رد می‌شود، نه اینکه بی‌صدا کلیدی با
حساب ناقص ذخیره شود. مودال‌های افزودن/ویرایش توکن همان فیلدها را یکی‌یکی می‌پرسند
(فیلدهای محرمانه به‌صورت ورودی رمز).

**هر ارائه‌دهنده‌ای می‌تواند فیلدهای خودش را اعلام کند** — در صفحه جزئیات ارائه‌دهنده،
هر خط یک فیلد، در ویرایشگر فیلدهای اعتبارنامه:

```
key | Label | url|query|header | Header-Name | optional,secret
```

تنها ستون الزامی `key` است؛ بقیه به‌طور پیش‌فرض `url` برای هدف، خود کلید برای برچسب و
نام روی سیم، و `required` هستند. محل قرارگیری هر فیلد:

| هدف | اثر |
|---|---|
| `url` | جای `{key}` در Base URL ارائه‌دهنده را پر می‌کند (مثلاً `.../accounts/{account_id}/ai/v1`) |
| `query` | به URL به‌شکل `?key=value` اضافه می‌شود |
| `header` | به‌عنوان هدری با آن نام ارسال می‌شود |

تنظیم **auth style** کنارش کنترل می‌کند که خود کلید چطور فرستاده شود: `bearer`
(پیش‌فرض)، `x-api-key`، `api-key`، `header:<Name>`، `query:<param>`، `none`.

کلیدهایی که فیلد همراه الزامی ندارند **توسط مسیریاب نادیده گرفته می‌شوند** — کلید
نیمه‌تنظیم‌شده هرگز جلوتر از کلید سالم انتخاب نمی‌شود — و درخواستی که آن ارائه‌دهنده
را نام ببرد با `400` و ذکر فیلد گمشده پاسخ می‌گیرد.

> **پشتیبانی نمی‌شود:** ارائه‌دهنده‌هایی که هر درخواست را امضا می‌کنند یا کلید را با
> توکن کوتاه‌مدت مبادله می‌کنند — AWS Bedrock (SigV4)، Vertex AI با OAuth حساب
> سرویس، Tencent Cloud (TC3)، Baidu (مبادله OAuth قدیمی)، احراز هویت key-pair
> Snowflake، و Azure Entra ID. این‌ها رمزنگاری در هر درخواست می‌خواهند که در تنظیمات
> Worker اینجا قابل بیان نیست؛ هرجا ارائه‌دهنده کلید ساده ارائه می‌دهد از آن استفاده کنید.

### دامین اختصاصی (اختیاری)

برای استفاده از دامین خودتان به‌جای `*.workers.dev`:

1. در [داشبورد کلادفلر](https://dash.cloudflare.com) یک دامین اختصاصی اضافه کنید
2. `wrangler.toml` را به‌روز کنید:

```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

### مدل داده (D1)

درگاه جدول‌های خودش را در اولین درخواست می‌سازد — مهاجرت دستی لازم نیست:

| جدول | کاربرد |
|---|---|
| `custom_providers` | ارائه‌دهندگان: نام، اسلاگ، base URL، کلیدها (+ اعتبارنامه‌های همراه)، auth style، راهبرد، مدل‌های کش‌شده |
| `api_keys` | توکن‌های درگاه (هش SHA-256 + پیشوند ذخیره می‌شود، هرگز خود کلید خام) |
| `token_usage` | شمار فراخوانی هر کلید هر ارائه‌دهنده (محرک `least-used`) |
| `usage_summary` | مصرف روزانه هر توکن و مدل برای تحلیل‌ها |
| `api_status` | وضعیت سلامت ارائه‌دهندگان |
| `app_settings` | هش گذرواژه مدیر، وضعیت راه‌اندازی |

---

## 🔒 مدل امنیتی

- **توکن‌های درگاه** به‌صورت هش SHA-256 ذخیره می‌شوند — توکن خام فقط یک بار هنگام
  ساخت نمایش داده می‌شود و دیگر هرگز. فقط پیشوند `sk-` برای شناسایی نگه داشته می‌شود.
- **کلیدهای ارائه‌دهندگان** در D1 (فضای ذخیره‌سازی اج کلادفلر) زندگی می‌کنند؛ سکرت‌های
  مدیریتی (`ADMIN_PASSWORD`، `SESSION_SECRET`) باید به‌صورت سکرت رمزنگاری‌شده ورکر ست شوند.
- **نشست‌ها** کوکی‌های امضاشده با HMAC هستند (انقضای ۲۴ساعته). پاسخ‌های HTML مدیریتی
  هدر `Cache-Control: no-store` دارند.
- **فیlover ذاتاً امن است:** فقط خطاهای قطعیِ بی‌خطر سریع برمی‌گردند؛ خطاهای
  اعتبار/سهمیه/قطعی روی ارائه‌دهنده بعدی retry می‌شوند.
- **بهترین روش‌ها:** برای جلوگیری از فشار روی یک کلید از `least-used` یا `round-robin`
  استفاده کنید، کلیدهای ارائه‌دهندگان را دوره‌ای بچرخانید، به هر کلاینت یک توکن درگاه
  جدا بدهید تا تحلیل‌های مصرف معنادار بمانند، و هرگز `wrangler.toml` با `database_id`
  واقعی را در فورک عمومی‌ای که مال شما نیست کامیت نکنید.

---

## 🏗️ معماری

ورکر تک‌فایل (`src/index.js`، حدود ۶٬۶۰۰ خط) — رابط مدیریتی HTML، مسیریابی و ترجمه
گویش‌ها همه در یک واحد قابل‌استقرار زندگی می‌کنند:

```
cfrouter/
├── src/
│   └── index.js          # کل درگاه (مسیرها، رابط کاربری، ترجمه)
├── wrangler.toml          # پیکربندی ورکر + بایندینگ D1
├── package.json
├── .github/
│   └── workflows/
│       └── ci.yml         # پایپ‌لاین اعتبارسنجی + دیپلوی
├── README.md              # مستندات انگلیسی
├── README.fa.md           # مستندات فارسی (این فایل)
├── README.fr.md           # مستندات فرانسوی
├── README.ar.md           # مستندات عربی
├── README.es.md           # مستندات اسپانیایی
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## 🛠️ توسعه

```bash
# اجرای سرور توسعه محلی
npm run dev

# استقرار در پروداکشن
npm run deploy

# مشاهده لاگ‌های زنده
npm run tail
```

### D1 محلی

```bash
wrangler d1 create cfrouter-db --local
# id را در wrangler.toml بچسبانید، بعد:
npm run dev
```

پنل مدیریت: `http://localhost:8787/admin` · سلامت: `http://localhost:8787/v1/health`

---

## 🤝 مشارکت

مشارکت‌ها خوش‌آمدند! راهنما را در [CONTRIBUTING.md](CONTRIBUTING.md) ببینید.
لطفاً پیش از مشارکت [آیین‌نامه رفتاری](CODE_OF_CONDUCT.md) را بخوانید.

---

## 📄 لایسنس

لایسنس MIT — جزئیات را در [LICENSE](LICENSE) ببینید.

---

## 🔗 پروژه‌های مرتبط

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Anthropic API](https://docs.anthropic.com/en/api/messages)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) · [Cline](https://github.com/cline/cline) · [Continue](https://github.com/continuedev/continue)

---

## کلیدواژه‌ها

`cloudflare workers` `ai gateway` `openai compatible` `anthropic compatible` `gemini compatible` `api proxy` `load balancer` `llm proxy` `ai router` `cloudflare d1` `ai agent` `vscode copilot` `cline` `claude code` `round robin` `failover` `chat completions` `llm load balancing` `multi provider` `edge computing` `serverless ai` `api management`
