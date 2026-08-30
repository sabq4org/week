# Economy Week

بوابة البيانات الاقتصادية السعودية — «الرقم الرسمي، مفهومًا، كل أسبوع».

- **الوثيقة المؤسِّسة:** `docs/economy-week-brief.md`
- **المبدأ:** كل رقم له مصدر ووقت جلب ومراجعة ومنهجية. الحسابات برمجية حتمية؛ لا نموذج لغوي ينشئ أرقامًا.

## التشغيل

```bash
npm install
cp .env.example .env.local   # واملأ DATABASE_URL
npm run db:push              # مزامنة المخطط إلى Postgres
npm run ingest               # أول جلب من ساما (مؤشرات + صرف)
npm run dev
```

## البنية

| المسار | الدور |
|---|---|
| `src/db/schema.ts` | نواة النموذج: sources → datasets → metrics → series → observations (بمراجعات) + events/stories/issues |
| `src/lib/sama/` | عميل ساما (JSON غير موثق، IPv4 إجباريًا) + المؤشرات + الصرف |
| `src/ingest/sama.ts` | الجلب إلى القاعدة — idempotent، القيمة المتغيرة لفترة قائمة = مراجعة جديدة |
| `src/lib/home.ts` | استعلامات الرئيسية + مولد قصة اليوم (قواعد حتمية) |
| `src/app/api/ingest` | نقطة الكرون: `POST /api/ingest` بـ`Bearer $INGEST_SECRET` |

## الجلب الدوري

كرون كل ٦ ساعات يكفي حاليًا:
`curl -X POST -H "Authorization: Bearer $INGEST_SECRET" https://<host>/api/ingest`

## فخاخ موثقة

- ساما تُسقط IPv6 — العميل يجبر `family: 4`.
- نقاط PortalHandler.ashx غير موثقة؛ المستهلكون يتحققون من الشكل ويرمون خطأً واضحًا عند تغيّره (يظهر في `ingest_runs.error`).
- رابط Neon عبر الـpooler: لا `SET` جلسي.
- المحاور الزمنية RTL: الأقدم يمينًا والأحدث يسارًا في كل الرسوم.
