# CFRouter — بوابة ذكاء اصطناعي متوافقة مع OpenAI وموجّه LLM وموازن تحميل لـ Cloudflare Workers

> **وجّه ووكّل ووازن الحمل وأدر عدة مزوّدي ذكاء اصطناعي عبر نقطة نهاية واحدة متوافقة مع OpenAI — بوابة LLM ذاتية الاستضافة تُنشر على شبكة Cloudflare الطرفية خلال دقائق.**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120.svg)](https://workers.cloudflare.com)
[![Docs](https://img.shields.io/badge/docs-English-blue.svg)](README.md)
[![Docs FA](https://img.shields.io/badge/docs-فارسی-green.svg)](README.fa.md)
[![Docs FR](https://img.shields.io/badge/docs-Français-purple.svg)](README.fr.md)
[![Docs AR](https://img.shields.io/badge/docs-العربية-orange.svg)](README.ar.md)
[![Docs ES](https://img.shields.io/badge/docs-Español-red.svg)](README.es.md)
[![Contact](https://img.shields.io/badge/contact-info%40barivan.com-0b7285.svg)](mailto:info@barivan.com)

**اقرأ بلغة:** [English](README.md) · [فارسی](README.fa.md) · [Français](README.fr.md) · [العربية](README.ar.md) · [Español](README.es.md)

> 🌍 **هذا التوثيق متوفّر بخمس لغات.** النسخة الإنجليزية هي المرجع وتواكب أحدث إصدار دائمًا؛
> وتغطّي الترجمات الفارسية والفرنسية والعربية والإسبانية الفصول ذاتها: التثبيت ومرجع API
> وربط وكلاء البرمجة والإعدادات والأمان. وعند أي اختلاف في الصياغة، فالنص الإنجليزي هو المعتمد.

---

## 📑 المحتويات

| القسم | الوصف |
|---------|-------------|
| [ما هو CFRouter؟](#ما-هو-cfrouter) | نظرة على المشروع |
| [التثبيت](#-التثبيت) | بنقرة واحدة أو CLI أو اللوحة — اختر طريقك |
| [البدء السريع (CLI)](#-البدء-السريع) | الخيار ب — للمطوّرين المرتاحين مع الطرفية |
| [التثبيت عبر لوحة Cloudflare](#️-التثبيت-عبر-لوحة-cloudflare-بدون-cli) | الخيار ج — النشر عبر واجهة الويب فقط |
| [الميزات](#-الميزات) | القائمة الكاملة |
| [مرجع API](#-مرجع-api) | توثيق النقاط النهائية |
| [ربط وكيل برمجي](#-ربط-وكيل-برمجي) | إعداد Claude Code وCline وContinue |
| [الإعدادات](#-الإعدادات) | ضبط متقدّم |
| [الأمان](#-النموذج-الأمني) | المصادقة والأسرار وأفضل الممارسات |
| [التطوير](#️-التطوير) | دليل التطوير المحلي |
| [الأسئلة الشائعة](#-الأسئلة-الشائعة) | مجاني؟ مقارنة بـ LiteLLM؟ المفاتيح؟ الفرق؟ |
| [تواصل معنا](#-تواصل-معنا) | البريد، المشكلات، الإفصاح الأمني |

---

## ما هو CFRouter؟

CFRouter هو **بوابة API ذكاء اصطناعي ذاتية الاستضافة** مبنية كـ Cloudflare Worker واحد. يعمل **كوكيل عكسي** **وموازن تحميل** لمزوّدي النماذج اللغوية مثل OpenAI وAnthropic وGoogle Gemini وأي API متوافق مع OpenAI — ليمنحك نقطة نهاية موحّدة لجميع أعباء الذكاء الاصطناعي لديك.

إذا كنت تبني مع **وكلاء الذكاء الاصطناعي** (VSCode Copilot وCline وContinue وCursor)، أو تشغّل **تطبيقات مدعومة بالنماذج**، أو تدير **مفاتيح API متعددة** عبر المزوّدين، فإن CFRouter يمنحك طبقة توجيه نظيفة وقابلة للمراقبة واقتصادية على شبكة Cloudflare الطرفية العالمية.

انظر إليه كموجّه LLM ذاتي الاستضافة تملكه من طرف إلى طرف: لا بوابة طرف ثالث في مسار الطلب، ولا هامش سعر على كل رمز (token)، ومفاتيح مزوّديك تبقى في قاعدة Cloudflare D1 الخاصة بك. إنه بديل مفتوح المصدر (MIT) للبوابات المستضافة ولتشغيل LiteLLM أو OpenRouter أو وكيل على طراز Portkey بنفسك — مع التحوّل التلقائي وتدوير مفاتيح API واستدعاء الأدوات وتحليلات الاستخدام جاهزة. ملف Worker واحد وأمر `wrangler deploy` واحد، وكل النماذج المتاحة لك تُجيب على عنوان واحد متوافق مع OpenAI.

### لأي شيء يُستخدم

- **وكلاء البرمجة** — وجّه Claude Code وCline وContinue وCursor وVS Code Copilot إلى عنوان أساسي واحد بدل لصق مفاتيح المزوّدين في كل أداة.
- **موازنة الحمل بين عدة مزوّدين** — وزّع طلبات إكمال المحادثة على OpenAI وAnthropic وGemini وOpenRouter وDeepSeek وGroq أو خادم vLLM الخاص بك، باختيار المفاتيح round-robin أو least-used أو sequential.
- **الصمود أمام حدود المعدّل والانقطاعات** — خطأ `429` أو `401` أو `5xx` من مزوّد يُعاد تجربته تلقائيًّا على المزوّد المُفعَّل التالي، فتبقى وكلاؤك وتطبيقاتك تعمل.
- **بوابة للفريق** — امنح كل مطوّر أو تطبيق رمز `sk-` خاصًّا به، ثم راقب استهلاك الرموز والتكلفة لكل مفتاح ونموذج في اللوحة.
- **النشر الطرفي** — Worker واحد وقاعدة D1 واحدة ولا خوادم لتحديثها؛ يعمل الوكيل داخل شبكة Cloudflare قريبًا من مستخدميك.
- **ترجمة اللهجات** — نادِ Claude عبر API الخاص بـ OpenAI، أو Gemini عبر Messages API من Anthropic؛ تُترجم البوابة الطلب والاستجابة في الاتجاهين، بما في ذلك البثّ.

### بوابة واحدة، بلا خوادم

- **بلا خادم تدفع له أو تُحدّثه** — الموجّه كله Worker واحد مع قاعدة D1 واحدة، والخطة
  المجانية من Cloudflare تكفي عادةً لفريق كامل.
- **موجّه واحد لكل مشاريعك** — وجّه كل تطبيقاتك وسكربتاتك ووكلائك إلى البوابة نفسها بدل
  تشتيت مفاتيح المزوّدين بين المشاريع.
- **مفاتيحك، تُدار مركزيًّا** — مفاتيح المزوّدين تبقى في D1 الخاصة بك؛ وزّع رموز `sk-` قابلة
  للإلغاء لكل تطبيق أو مطوّر أو عميل، وراقب الاستخدام لكل رمز.
- **حصّة أكبر عبر التدوير متعدد المفاتيح** — أرفق عدة مفاتيح لكل مزوّد واختر استراتيجية
  `round-robin` (أو `least-used`)؛ توزّع البوابة الطلبات عليها، فلا يعود حدّ المعدّل سقفًا
  لمفتاح واحد.

### كيف يعمل

```
عميلك (وكيل، تطبيق، curl)
        │
        │  POST /v1/chat/completions   {"model": "openai/gpt-4o", ...}
        ▼
┌───────────────────────────────┐
│        CFRouter Worker        │  ← طرفية Cloudflare، قرب مستخدميك
│  ┌─────────────────────────┐  │
│  │ ترجمة اللهجات           │  │  Anthropic / Gemini ←→ OpenAI
│  │ التوجيه (slug/model)    │  │  اختيار المزوّد عبر الـ slug
│  │ اختيار المفتاح          │  │  round-robin / random / least-used / sequential
│  │ التحوّل التلقائي        │  │  تجاوز المزوّد المعطّل والمحاولة مع التالي
│  │ تتبّع الاستخدام         │  │  لكل مفتاح ونموذج ويوم
│  └─────────────────────────┘  │
└───────────┬───────────┬───────┘
            ▼           ▼
      المزوّد A     المزوّد B …   ← مفاتيح API وحساباتك
            │
     Cloudflare D1 (التحليلات)
```

تُترجم لهجات الطلب الثلاث (OpenAI وAnthropic وGemini) إلى صيغة داخلية واحدة،
وتُوجَّه إلى المزوّد الذي سمّيته، ثم تُبثّ الإجابة باللهجة التي يتوقعها عميلك.

---

## ✨ الميزات

| الميزة | الوصف |
|---|---|
| **API متوافق مع OpenAI** | بديل مباشر لـ API أوبن أيه آي — يعمل مع أي عميل يفهم بروتوكول `/v1/chat/completions` |
| **ثلاث لهجات API** | Messages API الأصلي من Anthropic على `/v1/messages`، وAPI الأصلي من Gemini على `/v1beta/models/…`، بالإضافة إلى OpenAI — بوابة واحدة لكل العملاء |
| **استدعاء الأدوات** | استدعاء كامل للأدوات/الدوال على اللهجات الثلاث، بثًّا وغير بثّ — ما يحتاجه وكلاء البرمجة |
| **جاهز لـ Claude Code** | `/v1/messages` و`/v1/messages/count_tokens` ومصادقة `x-api-key` — اضبط `ANTHROPIC_BASE_URL` وانطلق |
| **موازنة تحميل متعددة المزوّدين** | توجيه `slug/model` عبر عدد غير محدود من المزوّدين، لكلٍّ مفاتيح API متعددة |
| **٤ استراتيجيات للمفاتيح** | `round-robin` و`random` و`least-used` و`sequential` — قابلة للضبط لكل مزوّد |
| **تحوّل تلقائي** | خطأ `401/403/429/5xx` من مزوّد ← إعادة محاولة شفافة على التالي؛ الأخطاء النهائية (`400/404/422`) تفشل سريعًا |
| **لوحة الإدارة** | واجهة ويب بسبعة تبويبات: التحليلات والصحة والمزوّدون والنماذج والملعب والرموز والتوثيق |
| **كتالوج ٧٩ مزوّدًا** | إعدادات مسبقة بنقرة واحدة: مختبرات الطليعة ومضيفو الاستدلال والبوابات والإقليمية والمؤسسية والإعلامية |
| **الملعب** | حاور أي نموذج من اللوحة مباشرة — بثّ وsystem prompt وtemperature و`max_tokens` و`top_p` |
| **تنسيق النماذج** | إخفاء النماذج من القائمة العامة `/models` فرادى أو جماعيًّا — النماذج المخفية تبقى قابلة للاستدعاء فلا يتعطّل عملاؤك الحاليون |
| **تتبّع الاستخدام** | تحليلات الرموز لكل مفتاح ونموذج في Cloudflare D1 |
| **دعم البثّ** | بثّ SSE كامل مع تحويل شفاف للاستجابة بين اللهجات |
| **مراقبة الصحة** | حالة صحية لحظية للمزوّدين وتوفّر النقاط النهائية |
| **CORS مفعّل** | جاهز لتطبيقات الذكاء الاصطناعي في المتصفح — الترويسات المخصصة لـ Anthropic وGemini وOpenAI مسموحة |
| **إزالة الاستدلال** | تُزال حقول `reasoning_content` (مثل Qwen3) تلقائيًّا للعملاء الحسّاسة |
| **نشر بلا إعداد** | ملف واحد وأمر `wrangler deploy` واحد |

---

## 💿 التثبيت

اختر الطريق الذي يناسبك — الطرق الثلاثة تنتهي إلى البوابة نفسها:

| الطريق | الأنسب لـ | التفاصيل |
|---|---|---|
| **أ. النشر بنقرة واحدة** | الأسرع: بلا طرفية ولا نسخ ولصق | زر Deploy أدناه |
| [**ب. البدء السريع بـ CLI**](#-البدء-السريع) | المطوّرون الذين يعيشون في الطرفية | استنساخ + `wrangler deploy` |
| [**ج. اللوحة، بلا CLI**](#️-التثبيت-عبر-لوحة-cloudflare-بدون-cli) | بالنقر فقط، مع تحكّم كامل | واجهة Cloudflare |

تنتهي الطرق الثلاثة بالخطوات الثلاث نفسها: **أضف مزوّدًا ← أنشئ رمز البوابة ← وجّه عملاءك
إلى البوابة**. كل طريق مشروح أدناه على حدة.

### الخيار أ: النشر بنقرة واحدة

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/barivanlab/cfrouter)

1. انقر **Deploy to Cloudflare** — يُنشأ الـ Worker وقاعدة D1 الخاصة به في حساب Cloudflare
   الخاص بك.
2. عند المطالبة، عيّن `ADMIN_PASSWORD` و`SESSION_SECRET` (أو تخطَّ الاثنين وزُر `/setup` في
   أول زيارة — سيحفظهما المعالج لك).
3. من هنا تتقارب الطرق كلها: تابع من
   [الخطوة ٨: الوصول إلى لوحة الإدارة](#الخطوة-٨-الوصول-إلى-لوحة-الإدارة) — أضف مزوّدًا،
   وانقر Fetch Models، وأنشئ رمزًا تحت **Tokens**، ثم أرسل طلبك الأول.

---

## 🚀 البدء السريع

> **الخيار ب — طريق CLI.** تُفضّل النقرة الواحدة أو بلا طرفية؟ استخدم
> [الخيار أ](#-التثبيت) أو
> [الخيار ج](#️-التثبيت-عبر-لوحة-cloudflare-بدون-cli).

### المتطلبات

- [Node.js](https://nodejs.org/) بإصدار ١٨ أو أعلى
- [حساب Cloudflare](https://dash.cloudflare.com/sign-up) (الخطة المجانية كافية)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### ١. الاستنساخ والتثبيت

```bash
git clone https://github.com/barivanlab/cfrouter.git
cd cfrouter
npm install
```

### ٢. إنشاء قاعدة D1

```bash
wrangler d1 create cfrouter-db
```

انسخ `database_id` من المخرجات والصقه في `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cfrouter-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### ٣. تعيين الأسرار

```bash
wrangler secret put ADMIN_PASSWORD
# أدخل كلمة مرور قوية (٦ أحرف على الأقل)

wrangler secret put SESSION_SECRET
# أدخل سلسلة عشوائية، ١٦ حرفًا على الأقل (مثل openssl rand -hex 32)
```

### ٤. النشر

```bash
wrangler deploy
```

بوابتك حيّة على `https://cfrouter.<your-subdomain>.workers.dev` 🎉

### ٥. ضبط أوّل مزوّد

1. افتح `https://cfrouter.<your-subdomain>.workers.dev/admin`
2. سجّل الدخول بكلمة المرور التي عيّنتها
3. انقر **+ Add Provider** (أو اختر إعدادًا مسبقًا من الكتالوج)
4. أدخل بيانات المزوّد (الاسم وعنوان الأساس ومفاتيح API)
5. انقر **Fetch Models** لاكتشاف النماذج المتاحة
6. تحت **Tokens** أنشئ رمز API لعملائك (يبدأ بـ `sk-`)

> **لا CLI؟** انتقل إلى [التثبيت عبر اللوحة](#️-التثبيت-عبر-لوحة-cloudflare-بدون-cli) — أو
> زُر `/setup` في أول زيارة لتعيين كلمة مرور المدير من المتصفح.

---

## 🖥️ التثبيت عبر لوحة Cloudflare (بدون CLI)

> هذا الدليل لمن يفضّلون النشر كاملًا عبر واجهة Cloudflare — دون طرفية أو Wrangler CLI.

### المتطلبات

- ملف `src/index.js` من هذا المشروع
- محرّر نصوص (Notepad أو TextEdit أو VSCode…)

### الخطوة ١: تسجيل الدخول إلى Cloudflare

1. افتح المتصفح وانتقل إلى [dash.cloudflare.com](https://dash.cloudflare.com)
2. سجّل الدخول إلى حسابك

### الخطوة ٢: إنشاء قاعدة D1

1. في الشريط الجانبي الأيسر انقر **Workers & Pages**
2. اختر تبويب **D1**
3. انقر **Create database**
4. أدخل اسمًا (مثل `cfrouter-db`)
5. انقر **Create**
6. ⚠️ **مهم:** انسخ **Database ID** — ستحتاجه لاحقًا

### الخطوة ٣: إنشاء Worker

1. في الشريط الجانبي الأيسر انقر **Workers & Pages**
2. انقر **Create application**
3. اختر تبويب **Workers**
4. انقر **Create Worker**
5. أدخل اسمًا للـ Worker (مثل `cfrouter`)
6. انقر **Deploy**

### الخطوة ٤: إضافة الكود

1. بعد إنشاء الـ Worker انقر **Edit code**
2. في المحرّر الإلكتروني **احذف كل** الكود الافتراضي
3. الصق كامل محتوى `src/index.js` من هذا المشروع
4. انقر **Save and deploy**

> 💡 **تلميح:** إذا لم يكن لديك `src/index.js` بعد:
> - انتقل إلى [github.com/barivanlab/cfrouter](https://github.com/barivanlab/cfrouter)
> - انقر **Code** ← **Download ZIP**
> - فكّ ضغط الأرشيف
> - جِد `src/index.js` بداخله

### الخطوة ٥: ربط القاعدة بالـ Worker

1. في صفحة الـ Worker انتقل إلى تبويب **Settings**
2. جِد قسم **Bindings**
3. انقر **Add binding**
4. اختر **D1 Database** كنوع الربط
5. املأ:
   - **Variable name:** `DB`
   - **D1 database:** اختر القاعدة التي أنشأتها في الخطوة ٢ (`cfrouter-db`)
6. انقر **Deploy**

### الخطوة ٦: تعيين متغيرات البيئة (الأسرار)

1. ما زلت في صفحة الـ Worker، انتقل إلى تبويب **Settings**
2. جِد قسم **Variables and Secrets**
3. انقر **Add variable**

**السرّ ١ — كلمة مرور المدير:**
- **Variable name:** `ADMIN_PASSWORD`
- **Value:** أدخل كلمة مرور قوية
- ✅ ضع علامة **Encrypt** (مهم!)
- انقر **Add variable**

**السرّ ٢ — مفتاح الجلسة:**
- انقر **Add variable** مجددًا
- **Variable name:** `SESSION_SECRET`
- **Value:** أدخل سلسلة عشوائية طويلة (مثل `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- ✅ ضع علامة **Encrypt**
- انقر **Add variable**

> 💡 **تلميح:** لتوليد سلسلة عشوائية استخدم [random.org/strings](https://www.random.org/strings/) — ولّد سلسلة من ٣٢ حرفًا.

> **بديل: معالج الإعداد** — إذا تخطّيت هذه الخطوة يمكنك تعيين القيم عبر معالج الويب على `/setup` في أول زيارة.

### الخطوة ٧: التحقق من عمل الـ Worker

1. انتقل إلى تبويب **Triggers** في صفحة الـ Worker
2. جِد قسم **Domains & Routes**
3. الـ Worker متاح على عنوان مثل `cfrouter.your-subdomain.workers.dev`
4. اختبر بفتح هذا الرابط في المتصفح:
   ```
   https://cfrouter.your-subdomain.workers.dev/v1/health
   ```

### الخطوة ٨: الوصول إلى لوحة الإدارة

1. افتح هذا الرابط في المتصفح:
   ```
   https://cfrouter.your-subdomain.workers.dev/admin
   ```
2. سجّل الدخول بكلمة المرور من الخطوة ٦

### الخطوة ٩: إضافة أوّل مزوّد

1. انقر **Providers** في الشريط الجانبي
2. انقر **+ Add Provider**
3. املأ البيانات:
   - **Name:** أي اسم (مثل «OpenAI»)
   - **Base URL:** عنوان API الأساسي للمزوّد
     - OpenAI: `https://api.openai.com/v1`
     - Anthropic: `https://api.anthropic.com/v1`
     - Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
   - **API Keys:** أدخل مفاتيح API (واحد في كل سطر)
4. انقر **Fetch Models** لاكتشاف النماذج المتاحة
5. انقر **Save**

### الخطوة ١٠: إنشاء رمز API

1. انقر **Tokens** في الشريط الجانبي
2. انقر **+ Create Token**
3. أدخل اسمًا (مثل «VSCode»)
4. انقر **Create Token**
5. ⚠️ **مهم:** انسخ الرمز **الآن** — يُعرض مرة واحدة فقط!

### الخطوة ١١: الاختبار والاستخدام

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "مرحبًا!"}]
  }'
```

> **ملاحظة:** معرّفات النماذج بصيغة `slug/model` (انظر [صيغة معرّف النموذج](#صيغة-معرّف-النموذج)).
> `gpt-4o` وحده يُبثّ إلى كل المزوّدين؛ `openai/gpt-4o` يذهب إلى OpenAI فقط.

---

### 📋 مرجع سريع — خطوات تثبيت اللوحة

| الخطوة | الإجراء |
|------|--------|
| ١ | تسجيل الدخول إلى [dash.cloudflare.com](https://dash.cloudflare.com) |
| ٢ | إنشاء قاعدة D1 ← نسخ Database ID |
| ٣ | إنشاء Worker جديد |
| ٤ | لصق كود `src/index.js` في المحرّر الإلكتروني |
| ٥ | ربط D1 بالـ Worker (Binding: `DB`) |
| ٦ | تعيين `ADMIN_PASSWORD` و`SESSION_SECRET` |
| ٧ | التحقق من عمل الـ Worker على رابطه |
| ٨ | الوصول إلى لوحة الإدارة على `/admin` |
| ٩ | إضافة مزوّد |
| ١٠ | إنشاء رمز API |
| ١١ | استخدام الـ API |

### ⚠️ ملاحظات مهمة

1. **لا تنسَ كلمة المرور** — إن فقدتها ستحتاج لحذف الـ Worker وإعادة إنشائه
2. **انسخ الرمز** — رمز API يُعرض مرة واحدة فقط
3. **احتفظ بـ Database ID** — ستحتاجه لاستكشاف الأخطاء
4. **فعّل Encrypt دائمًا** — تأكّد من علامة Encrypt لكل الأسرار
5. **أعد النشر بعد التغييرات** — بعد تعديل Settings أعد نشر الـ Worker

---

## 📖 مرجع API

### العنوان الأساسي

```
https://cfrouter.<your-subdomain>.workers.dev
```

### المصادقة

أرسل مفتاح API للبوابة في أي ترويسة يستخدمها عميلك. الثلاث مقبولة:

| الترويسة | يستخدمها |
|---|---|
| `Authorization: Bearer YOUR_API_KEY` | حزم OpenAI وCline وContinue ومعظم الأدوات |
| `x-api-key: YOUR_API_KEY` | حزم Anthropic وClaude Code |
| `x-goog-api-key` / `?key=` | حزم Gemini |

يجب أن يكون المفتاح رمز بوابة منشأً تحت **Tokens** (يبدأ بـ `sk-`) — لا مفتاح مزوّد.

### النقاط النهائية

| الطريقة | المسار | المصادقة | الوصف |
|---|---|---|---|
| `GET` | `/v1/models` | رمز | سرد كل النماذج المتاحة (معرّفات `slug/model`) |
| `POST` | `/v1/chat/completions` | رمز | إكمال محادثة (صيغة OpenAI، مع البثّ) |
| `POST` | `/v1/messages` | رمز | Messages API من Anthropic (مع البثّ والأدوات) |
| `POST` | `/v1/messages/count_tokens` | رمز | عدّ الرموز، يُجاب محليًّا |
| `POST` | `/v1beta/models/{model}:generateContent` | رمز | صيغة Gemini |
| `POST` | `/v1beta/models/{model}:streamGenerateContent` | رمز | صيغة Gemini، بثّ |
| `GET` | `/v1/health` | بلا | فحص صحة عام (بلا رمز) |
| `GET` | `/` · `/v1` | بلا | معلومات البوابة (النقاط والوقت) |
| `GET` | `/docs` | بلا | توثيق API تفاعلي |
| `GET` | `/admin` | كلمة المرور | لوحة الإدارة |
| *any* | *مسارات أخرى* | رمز | تُمرَّر كما هي إلى المزوّد الموجَّه (مثل `/v1/embeddings`) |

تُترجم اللهجات الثلاث إلى صيغة OpenAI وتُوجَّه إلى المزوّد المسمّى، فتخدم بوابة
واحدة كل عملائك. المسارات غير المذكورة (مثل `/v1/embeddings`) تُحوَّل دون تغيير
إلى المزوّد المختار.

### صيغة معرّف النموذج

تُخاطَب النماذج بصيغة `provider-slug/model-name`:

```
openai/gpt-4o
anthropic/claude-sonnet-4-20250514
my-proxy/llama-3-8b
```

الـ slug هو **slug** المزوّد في اللوحة (الافتراضي: اسم المزوّد بأحرف صغيرة
وشرطات). كل ما بعد أول شرطة مائلة يُمرَّر دون تغيير، فتعمل أيضًا معرّفات المنبع
التي تحوي شرطات:

```
openrouter/meta-llama/llama-3.1-70b-instruct
```

ملاحظات سلوكية:

- `slug/model` الذي لا يطابق slugُه أي مزوّد يردّ `404` مع سرد الـ slugs
  الموجودة — ما لم يعلن مزوّد فعلًا عن ذلك الاسم ذي الشرطة.
- الاسم العاري (بلا شرطة) **يُبثّ إلى كل المزوّدين المفعّلين** بالتناوب؛ أول نجاح
  يفوز. فضّل `slug/model` لتوجيه متوقّع.

### استدعاء الأدوات

يعمل استخدام الأدوات على اللهجات الثلاث، بثًّا وغير بثّ. هذا ما يجعل البوابة
صالحة لوكلاء البرمجة — فـ Claude Code وCline يقودان كل تعديل ملف وأمر صدفة عبر
استدعاءات الأدوات.

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

### مثال: إكمال محادثة

```bash
curl -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "مرحبًا!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### مثال: البثّ

```bash
curl -N -X POST https://cfrouter.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-your-gateway-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "stream": true,
    "messages": [{"role": "user", "content": "عُدّ إلى خمسة."}]
  }'
```

### دلالات الأخطاء

تردّ الأخطاء بلهجة الطلب، لتعمل إعادات حزم SDK صحيحًا:

| الحالة | الرمز | الجسم |
|---|---|---|
| مفتاح بوابة غير صالح | `401` | طراز OpenAI (كل المسارات) |
| slug مزوّد مجهول | `404` | لهجة الطلب + الـ slugs الصالحة |
| طلب خاطئ لدى كل المزوّدين (`400/404/422`) | تمرير | خطأ المنبع دون تغيير |
| رفض من **كل** الأهداف (`401/403/429/5xx`) | `400/404/429` تُمرَّر، وإلا `502` | لهجة الطلب مع `upstream_status` |
| لا مزوّد مفعّل إطلاقًا | `503` | لهجة الطلب |

مهلة المنبع ١٢٠ ثانية لكل هدف.

---

## 🤖 ربط وكيل برمجي

وجّه وكيلك إلى البوابة بدل المزوّد. تحتاج ثلاثة أشياء، كلها من اللوحة:

1. **Base URL** — `https://cfrouter.<your-subdomain>.workers.dev/v1`
2. **API key** — أنشئ واحدًا تحت **Tokens** (يبدأ بـ `sk-`)
3. **Model** — `slug/model`، مثل `openai/gpt-4o`

يُوجَّه كل طلب إلى المزوّد المسمّى. إن تعطّل مزوّد أو رُفض مفتاحه، تعيد البوابة
المحاولة على مزوّد مفعّل آخر قبل الاستسلام.

### Claude Code

يتحدث Claude Code بـ Messages API من Anthropic، وتقدّمها البوابة أصليًّا على
`/v1/messages` — مع استخدام الأدوات. عيّن متغيرات البيئة:

```bash
export ANTHROPIC_BASE_URL="https://cfrouter.your-subdomain.workers.dev"
export ANTHROPIC_API_KEY="sk-your-gateway-token"
export ANTHROPIC_MODEL="anthropic/claude-sonnet-4-20250514"
```

`ANTHROPIC_BASE_URL` بلا لاحقة `/v1` — فـ Claude Code يلحق `/v1/messages` بنفسه.
ثم شغّل `claude` في مشروعك كالمعتاد. اطلب منه قراءة ملف: إن عاد الردّ بمحتوى
الملف فاستدعاء الأدوات يعمل من الطرف للطرف.

> فضّل `ANTHROPIC_API_KEY` على `ANTHROPIC_AUTH_TOKEN`. الأول يرسل المفتاح في
> ترويسة `x-api-key` والثاني في `Authorization: Bearer` — تقبل البوابة الاثنين،
> لكن `x-api-key` هي الترويسة التي يتوقع Claude Code استخدامها.

### Cline

في لوحة إعدادات Cline:

| الحقل | القيمة |
|---|---|
| **API Provider** | OpenAI Compatible |
| **Base URL** | `https://cfrouter.your-subdomain.workers.dev/v1` |
| **API Key** | رمز البوابة `sk-...` |
| **Model ID** | `slug/model`، مثل `openai/gpt-4o` |

يقرأ Cline ‏`GET /v1/models` لملء قائمته المنسدلة. كل نماذج كل المزوّدين
المفعّلين مسرودة هناك بصيغة `slug/model`، فاختر من القائمة أو اكتب يدويًّا. إن
غاب نموذج تحتاجه، أظهره من **Models** في اللوحة.

### Continue

في `~/.continue/config.json` أضف مدخلًا تحت `models`:

```json
{
  "title": "CFRouter",
  "provider": "openai",
  "model": "openai/gpt-4o",
  "apiBase": "https://cfrouter.your-subdomain.workers.dev/v1",
  "apiKey": "sk-your-gateway-token"
}
```

### Cursor / حزمة OpenAI

أي عميل يقبل عنوان OpenAI الأساسي يعمل — اضبط العنوان على
`https://cfrouter.<your-subdomain>.workers.dev/v1` والمفتاح على رمز البوابة
والنموذج على `slug/model`.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://cfrouter.<your-subdomain>.workers.dev/v1",
    api_key="sk-your-gateway-token",
)
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "مرحبًا!"}],
)
print(response.choices[0].message.content)
```

### روبوتات الدردشة والأتمتة والمزيد (n8n وHermes و…)

كل ما يتكلم بروتوكول OpenAI يعمل بالطريقة نفسها — بلا بنية تحتية إضافية:

- **n8n** — في عقدة OpenAI (أو عقدة HTTP Request)، عيّن الرابط الأساسي على
  `https://cfrouter.<your-subdomain>.workers.dev/v1` (أو
  [نطاقك المخصص](#نطاق-مخصص-اختياري))، والاعتماد على رمز البوابة `sk-`، والنموذج على
  `slug/model`.
- **روبوتات الدردشة والوكلاء بأسلوب Hermes** — أينما طلبت الأداة رابط OpenAI الأساسي ومفتاح
  API والنموذج، الصق القيم الثلاث نفسها. البثّ واستدعاء الأدوات يتصرفان مثل OpenAI، فتواصل
  مساعداتك العمل دون تغيير.
- بوابة واحدة تخدم وكلاء البرمجة وروبوتات الدردشة والأتمتة معًا — لكل منها رمزه، وكلها
  تُقاس في اللوحة نفسها.

### استكشاف الأخطاء

| العرَض | السبب | الحلّ |
|---|---|---|
| `401 Invalid API key` | المفتاح مفقود أو ليس رمز بوابة | استخدم رمز **البوابة** من **Tokens** (يبدأ بـ `sk-`) لا مفتاح المزوّد |
| `404 Unknown provider slug` | الـ slug لا يطابق أي مزوّد | يسرد الخطأ الـ slugs الصالحة — راجع تبويب **Providers** |
| الوكيل متجمّد بلا مخرجات | استجابة البثّ لا تكتمل | تحقق من Base URL ورمز المزوّد — اختبر المزوّد مباشرة عبر **Playground** |
| قائمة النماذج فارغة | مسار `/models` للمزوّد غير reachable من الـ Worker | تُستخدم القائمة المخزّنة من **Fetch Models**؛ أعد تشغيلها في Providers |
| `503 No providers available` | لا مزوّد مفعّل | فعّل واحدًا في **Providers** |

---

## 🔧 الإعدادات

### متغيرات البيئة (الأسرار)

| السرّ | مطلوب؟ | الوصف |
|---|---|---|
| `ADMIN_PASSWORD` | نعم (أو `/setup`) | كلمة مرور لوحة الإدارة (٦ أحرف على الأقل) |
| `SESSION_SECRET` | نعم (أو `/setup`) | مفتاح توقيع الجلسة (١٦ حرفًا على الأقل، يُنصح hex عشوائي) |

عيّن عبر `wrangler secret put ADMIN_PASSWORD` و`wrangler secret put SESSION_SECRET`،
أو تخطَّ الاثنين وزُر `/setup` في أول زيارة — سيحفظهما المعالج لك.

### إعدادات wrangler.toml

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

### استراتيجيات المفاتيح (لكل مزوّد)

يختار كل مزوّد استراتيجية لتدوير مفاتيح API:

| الاستراتيجية | السلوك |
|---|---|
| `round-robin` (الافتراضي) | تُستخدم المفاتيح بالتناوب — توزيع متساوٍ للحمل |
| `random` | اختيار عشوائي منتظم لكل طلب |
| `least-used` | المفتاح الأقل عدد استدعاءات (يُتتبَّع في D1) |
| `sequential` | أول مفتاح مفعّل دائمًا — متوقّع، مثالي لإعداد primary/backup |

غيّرها من صفحة تفاصيل المزوّد؛ وتُطبَّق على طلبات OpenAI وAnthropic وGemini سواء.

### نطاق مخصص (اختياري)

امنح بوابتك عنوانك الخاص — وسلّم ذلك العنوان لعملائك. توجيه Cloudflare نفسه يضع نطاقك
أمام الـ Worker، فيستخدمه العملاء كرابط أساسي تمامًا مثل عنوان `*.workers.dev` الافتراضي
(تُستخرج شهادة TLS تلقائيًّا).

**عبر لوحة Cloudflare (بلا ملف إعداد):**

1. افتح صفحة الـ Worker ← **Settings ← Domains & Routes ← Add ← Custom Domain**
2. أدخل مثلًا `api.yourdomain.com` (يجب أن تكون المنطقة على Cloudflare)
3. استخدم `https://api.yourdomain.com/v1` كرابط أساسي في كل مكان كنت تستخدم فيه رابط
   `workers.dev`

**عبر `wrangler.toml` (مسار على منطقة تملكها):**

```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

ثم `wrangler deploy` — باتت الطلبات إلى `https://api.yourdomain.com/*` تصل إلى هذا الـ Worker.

**خدمة عملائك على نطاقك:** أنشئ رمز بوابة لكل عميل تحت **Tokens** (يبدأ بـ `sk-`)، وسلّم كل
عميل الشيئين نفسهما — الرابط الأساسي لنطاقك ورمزه. يبقى الاستخدام منفصلًا لكل رمز في تبويب
التحليلات؛ فيخدم Worker واحد على نطاقك كل مشاريعك وعملائك، مع قابلية ملاحظة لكل عميل وبلا
أي بنية تحتية إضافية.

### نموذج البيانات (D1)

تنشئ البوابة جداولها عند أول طلب — لا ترحيلات يدوية:

| الجدول | الغرض |
|---|---|
| `custom_providers` | المزوّدون: الاسم والـ slug والعنوان والمفاتيح والاستراتيجية والنماذج المخزّنة |
| `api_keys` | رموز البوابة (تجزئة SHA-256 + بادئة، أبدًا المفتاح الخام) |
| `token_usage` | عدّادات الاستدعاء لكل مفتاح مزوّد (محرّك `least-used`) |
| `usage_summary` | الاستخدام اليومي لكل رمز ونموذج للتحليلات |
| `api_status` | حالة صحة المزوّدين |
| `app_settings` | تجزئة كلمة مرور المدير وحالة الإعداد |

---

## 🔒 النموذج الأمني

- **رموز البوابة** تُخزَّن كتجزئة SHA-256 — يُعرض الرمز الخام مرة واحدة عند الإنشاء
  فقط. تُحفَظ البادئة `sk-` للتعريف فقط.
- **مفاتيح المزوّدين** تعيش في D1 (تخزين Cloudflare الطرفي)؛ أسرار الإدارة
  (`ADMIN_PASSWORD` و`SESSION_SECRET`) يجب تعيينها كأسرار Worker مشفّرة.
- **الجلسات** ملفات تعريف موقّعة بـ HMAC (انتهاء ٢٤ ساعة). ردود HTML الإدارية
  تحمل `Cache-Control: no-store`.
- **التحوّل آمن بالتصميم:** الأخطاء النهائية وحدها تفشل سريعًا؛ أخطاء
  الاعتماد/الحصة/التعطّل تُعاد على المزوّد التالي.
- **أفضل الممارسات:** استخدم `least-used` أو `round-robin` لتجنّب الضغط على مفتاح
  واحد، ودوّر المفاتيح دوريًّا، وامنح كل عميل رمز بوابة مستقلًّا لتبقى التحليلات
  ذات معنى، ولا تلتزم أبدًا `wrangler.toml` فيه `database_id` حقيقي في fork عام
  لا تملكه.

---

## 🏗️ البنية

Worker بملف واحد (`src/index.js`، نحو ٦٬٦٠٠ سطر) — واجهة الإدارة HTML والتوجيه
وترجمة اللهجات كلها في وحدة نشر واحدة:

```
cfrouter/
├── src/
│   └── index.js          # البوابة كاملة (المسارات والواجهة والترجمة)
├── wrangler.toml          # إعداد Worker + ربط D1
├── package.json
├── .github/
│   └── workflows/
│       └── ci.yml         # خط تحقق + نشر
├── README.md              # التوثيق الإنجليزي
├── README.fa.md           # التوثيق الفارسي
├── README.fr.md           # التوثيق الفرنسي
├── README.ar.md           # التوثيق العربي (هذا الملف)
├── README.es.md           # التوثيق الإسباني
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## 🛠️ التطوير

```bash
# تشغيل خادم التطوير المحلي
npm run dev

# النشر إلى الإنتاج
npm run deploy

# عرض السجلات الحيّة
npm run tail
```

### D1 محلي

```bash
wrangler d1 create cfrouter-db --local
# الصق الـ id في wrangler.toml، ثم:
npm run dev
```

لوحة الإدارة: `http://localhost:8787/admin` · الصحة: `http://localhost:8787/v1/health`

---

## 🤝 المساهمة

المساهمات مرحّب بها! انظر [CONTRIBUTING.md](CONTRIBUTING.md).
يرجى قراءة [مدونة السلوك](CODE_OF_CONDUCT.md) قبل المشاركة — تصحيحات الترجمة وإضافة لغات جديدة لا تقلّ قيمة عن الكود.
هل لديك سؤال قبل البدء؟ اكتب إلى [info@barivan.com](mailto:info@barivan.com).

---

## 📄 الرخصة

رخصة MIT — انظر [LICENSE](LICENSE) للتفاصيل.

---

## 🔗 مشاريع ذات صلة

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Anthropic API](https://docs.anthropic.com/en/api/messages)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) · [Cline](https://github.com/cline/cline) · [Continue](https://github.com/continuedev/continue)

---

## ❓ الأسئلة الشائعة

**هل CFRouter مجاني؟**
نعم. CFRouter مفتوح المصدر برخصة MIT ويعمل داخل حساب Cloudflare الخاص بك: تدفع مقابل Cloudflare (الخطة المجانية تكفي عادة لفريق) وفواتير مزوّديك. لا هامش على الطلبات، ولا اشتراك، ولا خدمة طرف ثالث في مسار طلباتك.

**ما الفرق بينه وبين LiteLLM أو OpenRouter أو Portkey؟**
CFRouter هو Cloudflare Worker واحد مدعوم بقاعدة D1 خاصة به — لا شيء تستضيفه، ولا خدمة Python أو حاوية تحتاج تحديثات، ولا حساب وسيط بينك وبين مزوّديك. تحصل على موجّه متوافق مع OpenAI داخل حساب Cloudflare الخاص بك، مع تدوير مفاتيح round-robin وتحوّل تلقائي وكتالوج من ٧٩ مزوّدًا ولوحة إدارة لتحليلات الاستخدام.

**هل يمكن استخدامه مع Claude Code أو Cline أو Continue أو Cursor أو VS Code Copilot؟**
هذا هو الاستخدام الأساسي. يتحدّث Claude Code مع Messages API الأصلي من Anthropic على `/v1/messages`؛ أما بقية الوكلاء المتوافقين مع OpenAI فيتصلون بـ `/v1` برمز البوابة. يعمل استدعاء الأدوات (الدوال) على اللهجات الثلاث، بثًّا وغير بثّ — وهو ما يحتاجه وكلاء البرمجة في كل تعديل ملف وكل أمر طرفية.

**هل يعمل مع مزوّدين غير OpenAI وAnthropic وGemini؟**
أي نقطة نهاية متوافقة مع OpenAI: OpenRouter وGroq وDeepSeek وTogether وFireworks وCloudflare Workers AI وAzure OpenAI وSnowflake Cortex وModal أو خادم Ollama / vLLM ذاتي الاستضافة. تضمّ اللوحة ٧٩ إعدادًا مسبقًا، ويمكنك إضافة مزوّد مخصص بأي عنوان أساسي ونمط ترويسة وبيانات مرافقة يحتاجها.

**أين تبقى مفاتيح API وحركة البيانات؟**
في حساب Cloudflare الخاص بك. مفاتيح المزوّدين في قاعدة D1 الخاصة بك، ورموز البوابة تُخزَّن كتجزئات SHA-256 (يُعرض الرمز الخام مرة واحدة فقط)، وبيانات دخول المدير أسرار مشفَّرة في الـ Worker. تنتقل الطلبات من عميلك إلى مزوّدك عبر الـ Worker الخاص بك — لا تمرّ أي حركة أو مفتاح عبر خادم نتحكم به.

**هل يمكن تشغيله لفريق أو لعدة تطبيقات؟**
نعم. أنشئ رمز بوابة لكل عميل من قسم **Tokens**، واختر استراتيجية مفاتيح لكل مزوّد (`round-robin` أو `random` أو `least-used` أو `sequential`)، وتابع في تبويب التحليلات الاستهلاك لكل مفتاح ونموذج — مفيد للتسعير الداخلي، ولكشف وكيل يستهلك بلا حساب، ولمعرفة المزوّد الذي يخدم حركتك فعلًا.

**ماذا يحدث إذا تعطّل مزوّد أو بلغ حدّ المعدّل؟**
الطلبات التي تسمّي مزوّدًا معطّلًا يُعاد تجربتها بشفافية على المزوّد المُفعَّل التالي؛ الأخطاء النهائية فقط (`400` و`404` و`422`) تفشل سريعًا. والطلب الذي لا يسمّي أي مزوّد يُبثّ بترتيب round-robin ويأخذ أول استجابة ناجحة.

**هل يدعم البثّ؟**
نعم — بثّ SSE كامل على لهجات OpenAI وAnthropic وGemini، مع ترجمة الاستجابات بين الصيغ فور وصولها، بما في ذلك استدعاءات الأدوات المبثوثة.

**هل يمكن استخدامه مع روبوتات الدردشة أو n8n أو الوكلاء بأسلوب Hermes؟**
نعم — كل ما يتكلم بروتوكول OpenAI يتصل بالقيم الثلاث نفسها (الرابط الأساسي، ورمز `sk-`، و`slug/model`). بوابة واحدة تخدم وكلاء البرمجة وروبوتات الدردشة والأتمتة معًا، لكل منها رمزه، وبلا أي بنية تحتية لخوادم.

**هل يمكن خدمة نطاقي الخاص (وعملائي) منه؟**
نعم. ضع نطاقك أمام الـ Worker عبر توجيه Cloudflare، ثم سلّم كل عميل الرابط الأساسي لنطاقك مع رمز بوابة خاص به (انظر [نطاق مخصص](#نطاق-مخصص-اختياري)). يبقى الاستخدام منفصلًا لكل رمز؛ فيخدم Worker واحد على نطاقك كل مشاريعك وعملائك.

---

## 📬 تواصل معنا

الأسئلة وتقارير الأخطاء وتصحيحات الترجمة والدعم التجاري والإفصاحات الأمنية تصل كلها إلى العنوان نفسه:

- **البريد الإلكتروني:** [info@barivan.com](mailto:info@barivan.com)
- **المشكلات وطلبات الميزات:** [github.com/barivanlab/cfrouter/issues](https://github.com/barivanlab/cfrouter/issues)
- **النقاشات وأسئلة الاستخدام:** [github.com/barivanlab/cfrouter/discussions](https://github.com/barivanlab/cfrouter/discussions)
- **الأمان:** إشعار خاص فقط — انظر [SECURITY.md](SECURITY.md)، ولا تفتح مشكلة عامة أبدًا
