# CFRouter — گیت‌وی هوش مصنوعی سازگار با OpenAI برای Cloudflare Workers

> **مدیریت و مسیریابی چندین ارائه‌دهنده AI از طریق یک endpoint واحد سازگار با OpenAI — استقرار در چند دقیقه روی شبکه لبه Cloudflare.**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivan/cfrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120.svg)](workers.cloudflare.com)

---

## 📑 فهرست مطالب

| بخش | توضیحات |
|-----|---------|
| [آموزش نصب با خط فرمان (CLI)](#🇮🇷-آموزش-نصب-روی-پنل-cloudflare) | برای توسعه‌دهندگانی که با Terminal آشنا هستند |
| [آموزش نصب از پنل Cloudflare](#🖥️-نصب-از-طریق-پنل-cloudflare-بدون-نیاز-به-خط-فرمان) | برای کسانی که فقط از مرورگر استفاده می‌کنند |
| [امکانات](#✨-امکانات) | لیست امکانات پروژه |
| [مرجع API](#📖-مرجع-api) | مستندات endpointها |
| [پیکربندی](#🔧-پیکربندی) | تنظیمات پیشرفته |
| [عیب‌یابی](#🐛-عیب‌یابی) | حل مشکلات رایج |

---

## 🇮🇷 آموزش نصب روی پنل Cloudflare

### پیش‌نیازها

- یک حساب [Cloudflare](https://dash.cloudflare.com/sign-up) (رایگان کافی است)
- نصب [Node.js](https://nodejs.org/) نسخه 18 یا بالاتر
- نصب [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### مرحله 1: نصب Wrangler CLI

اگر هنوز Wrangler را نصب نکرده‌اید، این دستور را اجرا کنید:

```bash
npm install -g wrangler
```

برای اطمینان از نصب درست:

```bash
wrangler --version
```

### مرحله 2: ورود به حساب Cloudflare

```bash
wrangler login
```

یک پنجره مرورگر باز می‌شود. وارد حساب Cloudflare خود شوید و اجازه دسترسی بدهید.

### مرحله 3: دانلود پروژه

```bash
git clone https://github.com/barivan/cfrouter.git
cd cfrouter
npm install
```

### مرحله 4: ساخت دیتابیس D1

```bash
wrangler d1 create cfrouter-db
```

خروجی چیزی شبیه این خواهد بود:

```
✅ Successfully created DB 'cfrouter-db'
[[d1_databases]]
binding = "DB"
database_name = "cfrouter-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**مهم:** مقدار `database_id` را کپی کنید.

### مرحله 5: تنظیم wrangler.toml

فایل `wrangler.toml` را باز کنید و `database_id` را جایگزین کنید:

```toml
name = "cfrouter"
main = "src/index.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "cfrouter-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← اینجا را پر کنید
```

### مرحله 6: تنظیم رمز عبور ادمین

یک رمز عبور قوی انتخاب کنید و آن را تنظیم کنید:

```bash
wrangler secret put ADMIN_PASSWORD
# رمز عبور را تایپ کنید و Enter بزنید
```

یک رشته تصادفی برای امنیت نشست‌ها بسازید:

```bash
# اگر macOS یا Linux دارید:
openssl rand -hex 32

# خروجی را کپی کنید و سپس:
wrangler secret put SESSION_SECRET
# رشته کپی شده را paste کنید
```

### مرحله 7: استقرار روی Cloudflare

```bash
wrangler deploy
```

اگر موفق باشد، خروجی شبیه این است:

```
Uploaded cfrouter
Published cfrouter
  https://cfrouter.your-subdomain.workers.dev
```

🎉 **تبریک!** گیت‌وی شما آماده است!

### مرحله 8: ورود به پنل ادمین

1. مرورگر را باز کنید و به آدرس زیر بروید:
   ```
   https://cfrouter.your-subdomain.workers.dev/admin
   ```

2. با رمز عبوری که در مرحله 6 تنظیم کردید وارد شوید

### مرحله 9: اضافه کردن ارائه‌دهنده (Provider)

1. از منوی سمت چپ روی **Providers** کلیک کنید
2. دکمه **+ Add Provider** را بزنید
3. اطلاعات را پر کنید:
   - **Name**: نام دلخواه (مثلاً "OpenAI" یا "My Anthropic")
   - **Base URL**: آدرس API ارائه‌دهنده
     - OpenAI: `https://api.openai.com/v1`
     - Anthropic: `https://api.anthropic.com/v1`
     - Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
   - **API Keys**: کلیدهای API خود را وارد کنید (هر کلید در یک خط)
4. روی **Fetch Models** کلیک کنید تا مدل‌های موجود شناسایی شوند
5. **Save** را بزنید

### مرحله 10: ساخت توکن API

1. از منوی سمت چپ روی **Tokens** کلیک کنید
2. دکمه **+ Create Token** را بزنید
3. یک نام وارد کنید (مثلاً "VSCode" یا "My App")
4. **Create Token** را بزنید
5. ⚠️ **مهم:** توکن نمایش داده شده را **الان کپی کنید!** دیگر نمایش داده نخواهد شد

### مرحله 11: استفاده از API

حالا می‌توانید از گیت‌وی خود استفاده کنید:

```bash
# تست ساده
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "سلام!"}]
  }'
```

---

## 🖥️ نصب از طریق پنل Cloudflare (بدون نیاز به خط فرمان)

> این آموزش برای کسانی است که می‌خواهند **بدون نصب هیچ نرم‌افزاری** و فقط از طریق مرورگر، CFRouter را روی Cloudflare استقرار دهند.

### پیش‌نیازها

- یک حساب [Cloudflare](https://dash.cloudflare.com/sign-up) (رایگان)
- فایل `src/index.js` پروژه (از GitHub دانلود کنید)
- یک متن‌نویس ساده (Notepad, TextEdit, VSCode)

### مرحله ۱: ورود به پنل Cloudflare

1. مرورگر را باز کنید و به [dash.cloudflare.com](https://dash.cloudflare.com) بروید
2. وارد حساب خود شوید

### مرحله ۲: ساخت دیتابیس D1

1. از منوی سمت چپ روی **Workers & Pages** کلیک کنید
2. تب **D1** را انتخاب کنید
3. روی **Create database** کلیک کنید
4. نامی وارد کنید (مثلاً `cfrouter-db`)
5. روی **Create** کلیک کنید
6. ⚠️ **مهم:** شناسه دیتابیس (Database ID) را کپی کنید — آن را در جایی امن نگه دارید

### مرحله ۳: ساخت Worker

1. از منوی سمت چپ روی **Workers & Pages** کلیک کنید
2. روی **Create application** کلیک کنید
3. تب **Workers** را انتخاب کنید
4. روی **Create Worker** کلیک کنید
5. یک نام برای Worker وارد کنید (مثلاً `cfrouter`)
6. روی **Deploy** کلیک کنید

### مرحله ۴: کپی کردن کد

1. پس از ساخت Worker، روی **Edit code** کلیک کنید
2. در ویرایشگر آنلاین، **تمام کد پیش‌فرض** را پاک کنید
3. محتوای فایل `src/index.js` را از پروژه کپی کنید
4. روی **Save and deploy** کلیک کنید

> 💡 **نکته:** اگر فایل `src/index.js` را ندارید، از GitHub دانلودش کنید:
> - به [github.com/barivan/cfrouter](https://github.com/barivan/cfrouter) بروید
> - روی **Code** → **Download ZIP** کلیک کنید
> - فایل را از حالت فشرده خارج کنید
> - فایل `src/index.js` را پیدا کنید

### مرحله ۵: اتصال دیتابیس به Worker

1. از صفحه Worker، تب **Settings** را انتخاب کنید
2. بخش **Bindings** را پیدا کنید
3. روی **Add binding** کلیک کنید
4. نوع binding را **D1 Database** انتخاب کنید
5. فیلدها را پر کنید:
   - **Variable name**: `DB`
   - **D1 database**: دیتابیسی که در مرحله ۲ ساختید (`cfrouter-db`)
6. روی **Deploy** کلیک کنید

### مرحله ۶: تنظیم متغیرهای محیطی (Secrets)

1. همچنان در صفحه Worker، تب **Settings** را انتخاب کنید
2. بخش **Variables and Secrets** را پیدا کنید
3. روی **Add variable** کلیک کنید

**ecret اول — رمز عبور ادمین:**
- **Variable name**: `ADMIN_PASSWORD`
- **Value**: یک رمز عبور قوی وارد کنید
- ✅ تیک **Encrypt** را بزنید (مهم!)
- روی **Add variable** کلیک کنید

**ecret دوم — کلید نشست:**
- دوباره روی **Add variable** کلیک کنید
- **Variable name**: `SESSION_SECRET`
- **Value**: یک رشته تصادفی بلند وارد کنید (مثلاً `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- ✅ تیک **Encrypt** را بزنید
- روی **Add variable** کلیک کنید

> 💡 **نکته:** برای ساخت رشته تصادفی، می‌توانید از این سایت استفاده کنید:
> [random.org/string](https://www.random.org/strings/) — یک رشته ۳۲ کاراکتری بسازید

### مرحله ۷: فعال‌سازی Worker

1. از صفحه Worker، تب **Triggers** را انتخاب کنید
2. بخش **Domains & Routes** را پیدا کنید
3. Worker شما در حال حاضر با آدرسی مثل `cfrouter.your-subdomain.workers.dev` فعال است
4. برای تست، آدرس زیر را در مرورگر باز کنید:
   ```
   https://cfrouter.your-subdomain.workers.dev/v1/health
   ```

### مرحله ۸: ورود به پنل ادمین

1. آدرس زیر را در مرورگر باز کنید:
   ```
   https://cfrouter.your-subdomain.workers.dev/admin
   ```
2. با رمز عبوری که در مرحله ۶ تنظیم کردید وارد شوید

### مرحله ۹: اضافه کردن ارائه‌دهنده (Provider)

1. از منوی سمت چپ روی **Providers** کلیک کنید
2. دکمه **+ Add Provider** را بزنید
3. اطلاعات را پر کنید:
   - **Name**: نام دلخواه (مثلاً "OpenAI" یا "My Anthropic")
   - **Base URL**: آدرس API ارائه‌دهنده
     - OpenAI: `https://api.openai.com/v1`
     - Anthropic: `https://api.anthropic.com/v1`
     - Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
   - **API Keys**: کلیدهای API خود را وارد کنید (هر کلید در یک خط)
4. روی **Fetch Models** کلیک کنید تا مدل‌های موجود شناسایی شوند
5. **Save** را بزنید

### مرحله ۱۰: ساخت توکن API

1. از منوی سمت چپ روی **Tokens** کلیک کنید
2. دکمه **+ Create Token** را بزنید
3. یک نام وارد کنید (مثلاً "VSCode" یا "My App")
4. **Create Token** را بزنید
5. ⚠️ **مهم:** توکن نمایش داده شده را **الان کپی کنید!** دیگر نمایش داده نخواهد شد

### مرحله ۱۱: تست و استفاده

```bash
# تست ساده
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "سلام!"}]
  }'
```

---

### 📋 خلاصه مراحل نصب از پنل Cloudflare

| مرحله | کار |
|-------|-----|
| ۱ | ورود به [dash.cloudflare.com](https://dash.cloudflare.com) |
| ۲ | ساخت دیتابیس D1 → کپی Database ID |
| ۳ | ساخت Worker جدید |
| ۴ | کپی کد `src/index.js` در ویرایشگر آنلاین |
| ۵ | اتصال D1 به Worker (Binding: `DB`) |
| ۶ | تنظیم `ADMIN_PASSWORD` و `SESSION_SECRET` |
| ۷ | فعال‌سازی و تست آدرس Worker |
| ۸ | ورود به پنل ادمین (`/admin`) |
| ۹ | اضافه کردن Provider |
| ۱۰ | ساخت توکن API |
| ۱۱ | استفاده از API |

### ⚠️ نکات مهم هنگام نصب از پنل

1. **رمز عبور را فراموش نکنید** — اگر رمز عبور را فراموش کنید، باید Worker را حذف و دوباره بسازید
2. **توکن را کپی کنید** — توکن API فقط یک بار نمایش داده می‌شود
3. **Database ID را نگه دارید** — برای عیب‌یابی نیاز دارید
4. **Encrypt را فراموش نکنید** — حتماً تیک Encrypt را برای Secrets بزنید
5. **Worker را دوباره Deploy کنید** — بعد از هر تغییر در Settings، Worker را دوباره Deploy کنید

---

## ✨ امکانات

| امکان | توضیحات |
|-------|---------|
| **API سازگار با OpenAI** | جایگزین مستقیم API اپن‌ای‌آی — با هر کلاینتی که پروتکل `/v1/chat/completions` را بشناسد کار می‌کند |
| **بارگذاری متعادل چند ارائه‌دهنده** | مسیریابی Round-Robin بین ارائه‌دهندگان مختلف AI |
| **مدل‌های مستعار** | نام‌های کوتاه تعریف کنید (مثلاً `gpt-4o` → `openai/gpt-4o`) |
| **پنل مدیریت** | رابط وب داخلی برای مدیریت ارائه‌دهندگان، کلیدها و آمار |
| **ردیابی مصرف** | آمار مصرف توکن به ازای هر کلید و مدل |
| **پشتیبانی از Streaming** | پشتیبانی کامل از SSE با تبدیل شفاف پاسخ‌ها |
| **پایش سلامت** | وضعیت لحظه‌ای ارائه‌دهندگان و در دسترس بودن endpointها |
| **بازیابی خودکار** | endpointهایی که موقتاً غیرفعال شده‌اند خودکار فعال می‌شوند |
| **پشتیبانی CORS** | آماده برای اپلیکیشن‌های مبتنی بر مرورگر |
| **استقرار بدون تنظیم** | یک فایل، یک دستور `wrangler deploy` |
| **دیتابیس D1** | ذخیره‌سازی پایدار روی لبه Cloudflare — بدون نیاز به دیتابیس خارجی |

---

## 📖 مرجع API

### آدرس پایه

```
https://cfrouter.your-subdomain.workers.dev
```

### احراز هویت

کلید API را در هدر `Authorization` قرار دهید:

```
Authorization: Bearer YOUR_API_KEY
```

### endpointها

| متد | مسیر | توضیحات |
|-----|------|---------|
| `GET` | `/v1/models` | لیست تمام مدل‌های موجود |
| `POST` | `/v1/chat/completions` | ایجاد chat completion (فرمت OpenAI) |
| `POST` | `/v1/messages` | ایجاد chat completion (فرمت Anthropic) |
| `POST` | `/v1beta/models/{model}:generateContent` | ایجاد chat completion (فرمت Gemini) |
| `POST` | `/v1/embeddings` | ایجاد embeddings |
| `GET` | `/v1/health` | بررسی سلامت عمومی |
| `GET` | `/docs` | مستندات API |
| `GET` | `/admin` | پنل مدیریت |

### مثال: Chat Completion

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "سلام!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### فرمت نام مدل

مدل‌ها با فرمت `provider-slug/model-name` شناسایی می‌شوند:

```
openai/gpt-4o
anthropic/claude-3.5-sonnet
my-provider/llama-3-8b
```

از **مدل‌های مستعار** برای ایجاد نام‌های کوتاه استفاده کنید.

### نکات مهم

#### اتصال به VSCode / Cline / Continue

آدرس گیت‌وی و توکن API را در تنظیمات افزونه وارد کنید:

- **Base URL**: `https://cfrouter.your-subdomain.workers.dev/v1`
- **API Key**: توکنی که ساختید

#### استفاده از مدل‌های مستعار

در بخش **Aliases** از پنل ادمین، نام‌های کوتاه تعریف کنید:

- مثلاً `gpt4` → `openai/gpt-4o`
- سپس فقط `gpt4` را در درخواست‌ها استفاده کنید

#### فرمت‌های مختلف API

گیت‌وی از سه فرمت مختلف پشتیبانی می‌کند:

1. **OpenAI**: `POST /v1/chat/completions`
2. **Anthropic**: `POST /v1/messages`
3. **Gemini**: `POST /v1beta/models/{model}:generateContent`

---

## 🔧 پیکربندی

### متغیرهای محیطی (Secrets)

| Secret | توضیحات |
|--------|---------|
| `ADMIN_PASSWORD` | رمز عبور پنل مدیریت |
| `SESSION_SECRET` | کلید امنیتی برای امضای نشست‌ها |

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

### دامنه سفارشی (اختیاری)

برای استفاده از دامنه خود به جای `*.workers.dev`:

1. یک دامنه سفارشی در [پنل Cloudflare](https://dash.cloudflare.com) اضافه کنید
2. `wrangler.toml` را به‌روزرسانی کنید:

```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

---

## 🏗️ معماری

```
کلاینت (VSCode, Cline, App)
    │
    ▼
┌─────────────────────────┐
│    CFRouter Worker       │  ← لبه Cloudflare
│  ┃ 解析‌کننده مستعار      │
│  ┃ متعادل‌کننده بار       │
│  ┃ ردیاب مصرف            │
│  ┃ مبدل Streaming       │
│           │
│    ┌──────┴──────┐
│    ▼     ▼     ▼
│  ارائه‌دهنده A  B  C   │  ← Round-Robin
└─────────────────────────┘
         │
    Cloudflare D1 (آمار)
```

---

## 🛠️ توسعه

```bash
# شروع سرور توسعه محلی
npm run dev

# استقرار در محیط تولید
npm run deploy

# مشاهده لاگ‌های زنده
npm run tail
```

### ساختار پروژه

```
cfrouter/
├── src/
│   └── index.js          # فایل واحد Cloudflare Worker
├── wrangler.toml          # تنظیمات Cloudflare Workers
├── package.json
├── README.md              # مستندات انگلیسی
├── README_fa.md           # مستندات فارسی
├── CONTRIBUTING.md
└── LICENSE
```

---

## 🐛 عیب‌یابی

| مشکل | راه حل |
|------|--------|
| خطای 401 Unauthorized | توکن API معتبر نیست. توکن جدید بسازید |
| خطای 503 Service Unavailable | ارائه‌دهنده‌ای فعال نیست. Provider اضافه کنید |
| خطای 404 | آدرس اشتباه است. مستندات را در `/docs` بررسی کنید |
| ارور در Wrangler | مطمئن شوید `wrangler login` را اجرا کرده‌اید |
| دیتابیس پیدا نمی‌شود | `database_id` در `wrangler.toml` را بررسی کنید |
| مدل شناسایی نمی‌شود | نام مدل را با فرمت `provider/model` وارد کنید |

---

## 💰 هزینه

- **Cloudflare Workers**: پلن رایگان 100,000 درخواست در روز
- **Cloudflare D1**: پلن رایگان 5GB ذخیره‌سازی
- **هزینه کل**: عملاً رایگان برای استفاده شخصی! 🎉

---

## 🤝 مشارکت

مشارکت شما خوش‌آمدید! راهنمای مشارکت را در [CONTRIBUTING.md](CONTRIBUTING.md) بخوانید.

---

## 📄 مجوز

مجوز MIT — جزئیات را در [LICENSE](LICENSE) بخوانید.

---

## 🔗 پروژه‌های مرتبط

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

---

## کلمات کلیدی

`cloudflare workers` `ai gateway` `openai compatible` `api proxy` `load balancer` `llm proxy` `ai router` `cloudflare d1` `ai agent` `vscode copilot` `cline` `model alias` `round robin` `ai api` `chat completions` `llm load balancing` `multi provider` `edge computing` `serverless ai` `api management`
