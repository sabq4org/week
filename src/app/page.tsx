import { Spark } from "@/components/Spark";
import { StoryChart } from "@/components/StoryChart";
import {
  MACRO_CODES, STRIP_CODES, buildArchive, buildDailyBrief, buildHeadlines, buildStory, calendar,
  getMetricCards, getPosWeek, latestIssue, officialNewsFeed, posHeadline, releases, sourceHealth, topChanges,
} from "@/lib/home";
import { fmtNum } from "@/lib/format";
import { fmtDay, fmtMonthYear, fmtRelative } from "@/lib/format";

export const revalidate = 300;

const AR_MONTHS_SHORT = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default async function Home() {
  const cards = await getMetricCards();
  const strip = STRIP_CODES.map((c) => cards.find((x) => x.code === c)).filter((x) => x !== undefined);
  const macro = MACRO_CODES.map((c) => cards.find((x) => x.code === c)).filter((x) => x !== undefined);
  const story = buildStory(cards);
  const brief = buildDailyBrief(cards);
  const changes = topChanges(cards, 5);
  const rel = releases(cards.filter((c) => c.unit === "%" && !c.code.startsWith("mkt.")));
  const cal = calendar(cards);
  const news = await officialNewsFeed(5);
  const pos = await getPosWeek();
  const headlines = buildHeadlines(cards);
  const posHead = pos ? posHeadline(pos) : null;
  const archive = buildArchive(cards);
  const health = await sourceHealth(cards);
  const issue = await latestIssue();
  const now = new Date();

  return (
    <>
      <header className="topbar">
        <div className="container topbar-in">
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <a className="brand" href="/"><span>Economy</span> <b>Week</b></a>
            <nav className="nav">
              <a className="active" href="/">الآن</a>
              <a className="soon">المؤشرات</a>
              <a className="soon">العقار</a>
              <a className="soon">العدد الأسبوعي</a>
              <a className="soon">الشركات</a>
            </nav>
          </div>
          <a className="cta" href="#subscribe">اشترك في النشرة</a>
        </div>
      </header>

      <div className="strip">
        <div className="container strip-grid" style={{ width: "100%" }}>
          {strip.map((c) => {
            const prev = c.spark.length > 1 ? c.spark[c.spark.length - 2].value : null;
            const pct = c.delta != null && prev ? (c.delta / prev) * 100 : null;
            return (
              <div className="strip-cell" key={c.code} title={c.definitionAr ?? undefined}>
                <div className="strip-head">
                  <span>{c.shortAr}</span>
                  <span className={`dot ${c.fresh ? "ok" : "wait"}`} title={c.fresh ? "محدّث" : "متأخر"} />
                </div>
                <div className="strip-val num">
                  <b>{c.valueText}</b>
                  <span>{c.code === "mkt.brent" ? "للبرميل" : c.code === "mkt.gold" ? "للأونصة" : c.code.startsWith("fx.") ? "ريال" : ""}</span>
                </div>
                <div className="strip-foot">
                  <span className={`num ${c.deltaTone}`}>
                    {pct != null ? `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%` : "بلا تغيّر"}
                    <span style={{ color: "var(--muted)", fontWeight: 400 }}> يومي</span>
                  </span>
                  <Spark points={c.spark.slice(-14)} color={c.deltaTone === "bad" ? "#B4432B" : c.deltaTone === "good" ? "#0E6E63" : "#C9A227"} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <main className="container">
        <div className="section-head">
          <div>
            <div className="kicker">ECONOMY NOW</div>
            <h1 className="h1">ماذا تغيّر في اقتصاد السعودية الآن؟</h1>
          </div>
          <div className="meta">
            آخر جلب: {health.lastRun ? fmtRelative(health.lastRun) : "—"} ·{" "}
            <span className="good" style={{ fontWeight: 600 }}>{health.updated} مؤشرًا محدّثًا</span>
            {health.pending > 0 && <> · <span className="waiting" style={{ fontWeight: 600 }}>{health.pending} بانتظار الإصدار</span></>}
          </div>
        </div>

        {brief && (
          <div className="brief num-friendly">
            <span className="brief-k">موجز اليوم</span>
            <span className="brief-t">{brief.text}</span>
            <span className="brief-s">آليًا من حركة اليوم · {fmtRelative(brief.asOf)}</span>
          </div>
        )}


        {pos && posHead && (
          <section className="pos-hero card">
            <div className="pos-main">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="badge gold">أين راحت الفلوس؟</span>
                <span className="tagline">أسبوع {pos.labelAr} · البنك المركزي — تقرير نقاط البيع الأسبوعي</span>
              </div>
              <h2 className="pos-title">{posHead.title}</h2>
              <p className="dek">{posHead.sub}</p>
              <div className="pos-sectors">
                {pos.sectors.slice(0, 8).map((sec) => (
                  <div className="pos-sector" key={sec.ar}>
                    <div className="pos-sec-name">{sec.ar}</div>
                    <div className="pos-sec-val num">{fmtNum(sec.billions, 2)} <span>مليار</span></div>
                    <div className="pos-sec-bar"><span style={{ width: `${Math.min(100, sec.sharePct * (100 / (pos.sectors[0]?.sharePct || 1)))}%` }} /></div>
                    <div className={`pos-sec-d num ${sec.dv >= 0 ? "good" : "bad"}`}>{sec.dv >= 0 ? "+" : "−"}{fmtNum(Math.abs(sec.dv))}% أسبوعيًا</div>
                  </div>
                ))}
              </div>
              <div className="provenance" style={{ padding: "14px 0 0", borderTop: "1px solid var(--line-soft)" }}>
                <span>المصدر: <a href={pos.sourceUrl}>تقرير ساما الأسبوعي (PDF)</a> · جُلب {fmtRelative(pos.fetchedAt)} · القيم أحدث أسبوع في التقرير</span>
                <span className="actions"><span>كل القطاعات الثلاثين</span></span>
              </div>
            </div>
            <div className="pos-side">
              <div className="pos-side-h">أين؟ — أعلى المدن إنفاقًا</div>
              {pos.topCities.map((c, i) => (
                <div className="pos-city" key={c.ar}>
                  <span className="rank num">{i + 1}</span>
                  <span className="grow">{c.ar}</span>
                  <span className="num" style={{ fontWeight: 700 }}>{fmtNum(c.billions, 2)} مليار</span>
                  <span className={`num pos-city-d ${c.dv >= 0 ? "good" : "bad"}`}>{c.dv >= 0 ? "+" : "−"}{fmtNum(Math.abs(c.dv))}%</span>
                </div>
              ))}
              <div className="pos-side-note">من إجمالي {fmtNum(pos.totalBillions, 1)} مليار ريال — الرياض وحدها {fmtNum((pos.topCities[0]?.billions ?? 0) / pos.totalBillions * 100, 0)}%</div>
            </div>
          </section>
        )}

        {headlines.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div className="col-head"><b>مانشيتات الأرقام</b><span>مولّدة آليًا من النشرة الشهرية للبنك المركزي — بلا تحرير بشري</span></div>
            <div className="headlines">
              {headlines.map((h, i) => (
                <div className="card headline" key={i}>
                  <div className="headline-t">{h.title}</div>
                  <div className="headline-s">{h.sub}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="hero">
          {story && (
            <article className="card story">
              <div className="story-body">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="badge">قصة اليوم</span>
                  <span className="tagline">{story.tags}</span>
                </div>
                <h2>{story.title}</h2>
                <p className="dek" style={{ margin: 0 }}>{story.dek}</p>
              </div>
              <div className="chart-block">
                <div className="chart-cap">
                  <span>{story.metric.titleAr} — آخر 24 قراءة</span>
                  <span>الأقدم يمينًا</span>
                </div>
                <StoryChart points={story.metric.spark} unit={story.metric.unit} />
              </div>
              <div className="why">
                <b>لماذا يهم؟</b>
                <p>{story.why}</p>
              </div>
              <div className="provenance">
                <span>
                  المصدر: البنك المركزي السعودي · جُلب {story.metric.fetchedAt ? fmtRelative(story.metric.fetchedAt) : "—"} · الصياغة قوالب حتمية فوق أرقام محسوبة
                </span>
                <span className="actions"><span>CSV</span><span>تضمين</span><span>مشاركة</span></span>
              </div>
            </article>
          )}

          <aside className="top5">
            <div className="top5-head"><b>أهم الأرقام المتغيرة</b><span>بين آخر قراءتين</span></div>
            <ol>
              {changes.map((c, i) => (
                <li key={c.code}>
                  <span className="rank num">{i + 1}</span>
                  <span className="grow">
                    <div className="top5-t">{c.titleAr}</div>
                    <div className="top5-s">{c.periodLabel} · {c.code.startsWith("mkt.") ? "أسواق (مؤجل)" : "ساما"}</div>
                  </span>
                  <span className={`top5-d num ${c.deltaTone}`}>{c.deltaText}</span>
                </li>
              ))}
            </ol>
            <div className="more">الترتيب بالتغير النسبي المطلق — بلا اجتهاد تحريري</div>
          </aside>
        </div>

        <section style={{ marginTop: 40 }}>
          <div className="col-head"><b>الاقتصاد الكلي</b><span>البنك المركزي السعودي — بإيقاعه الرسمي</span></div>
          <div className="macro-grid">
            {macro.map((c) => (
              <div className="card macro-cell" key={c.code} title={c.definitionAr ?? undefined}>
                <div className="strip-head"><span>{c.shortAr}</span><span className={`dot ${c.fresh ? "ok" : "wait"}`} /></div>
                <div className="strip-val num"><b>{c.valueText}</b><span>{c.periodLabel}</span></div>
                <div className="strip-foot">
                  <span className={`num ${c.deltaTone}`}>{c.deltaText ?? "بلا تغيّر"}</span>
                  <Spark points={c.spark.slice(-12)} color="#0B1F3A" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="row3">
          <section>
            <div className="col-head"><b>من البنك المركزي</b><span>بيانات رسمية — تتجدد أسبوعيًا</span></div>
            <div className="card list-card">
              {news.map((n) => (
                <div key={n.id}>
                  <span className="impact high" />
                  <span className="grow">
                    <a className="li-t" href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                    <div className="li-s">{fmtDay(n.publishedAt.toISOString().slice(0, 10))}{n.summary ? ` · ${n.summary.slice(0, 90)}…` : ""}</div>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="col-head"><b>ما صدر من البيانات</b><span>مرتب حسب حداثة الفترة</span></div>
            <div className="card list-card">
              {rel.map((r, i) => (
                <div key={i}>
                  <span className={`impact ${r.impact}`} />
                  <span className="grow">
                    <div className="li-t">{r.titleAr}</div>
                    <div className="li-s">{r.datasetAr} · فترة {fmtMonthYear(r.period)} · جُلب {fmtRelative(r.fetchedAt)}</div>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div className="col-head"><b>تقويم الإصدارات</b><span>محسوب من الإيقاع</span></div>
              <div className="card list-card">
                {cal.slice(0, 3).map((c, i) => {
                  const [, m, d] = c.due.split("-").map(Number);
                  return (
                    <div key={i} className={c.lateDays ? "late" : undefined}>
                      <span className="cal-day">
                        <b className="num">{c.lateDays ? "—" : d}</b>
                        <span>{c.lateDays ? "متأخر" : AR_MONTHS_SHORT[(m ?? 1) - 1]}</span>
                      </span>
                      <span className="grow">
                        <div className="li-t">{c.titleAr}</div>
                        <div className="li-s">{c.noteAr}</div>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {archive.length > 0 && (
              <div>
                <div className="col-head"><b>من سجل السلاسل</b><span>مقارنات محسوبة</span></div>
                <div className="card list-card">
                  {archive.map((a, i) => (
                    <div key={i}>
                      <span className="impact low" />
                      <span className="grow">
                        <div className="li-t">{a.line}</div>
                        <div className="li-s">{a.sub}</div>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="weekly" id="subscribe">
          <div>
            <div className="k">ECONOMY WEEKLY{issue ? ` · العدد ${issue.number}` : ""}</div>
            <h3>{issue ? issue.title : "العدد الأول قيد الإعداد — يُغلق كل خميس"}</h3>
            <p>
              {issue?.dek ??
                "قصص بيانات من الأرقام الرسمية، رقم الأسبوع، رسم الأسبوع، وملخص إنجليزي محرّر. اترك بريدك ليصلك العدد الأول."}
            </p>
            <form className="sub-form" method="post" action="/api/subscribe">
              <input type="email" name="email" required placeholder="بريدك الإلكتروني" aria-label="البريد الإلكتروني" />
              <button className="cta" type="submit">اشترك</button>
            </form>
          </div>
          <div className="cell">
            <div className="k">رقم الأسبوع</div>
            <div className="bignum num">{issue?.numberOfWeekValue ?? (macro[0] ? macro[0].valueText : "—")}</div>
            <p>{issue?.numberOfWeekNote ?? (macro[0] ? `${macro[0].titleAr} في ${macro[0].periodLabel} — كما نشره البنك المركزي.` : "")}</p>
          </div>
          <div className="cell">
            <div className="k">Real Estate Lab</div>
            <p style={{ fontSize: 15, color: "#fff", fontWeight: 600, lineHeight: 1.8 }}>مختبر العقار — المرحلة القادمة</p>
            <p>صفقات المدن والأحياء من بيانات وزارة العدل بعد بوابة الجودة. لا نعرض رقمًا عقاريًا قبل اجتيازها — هنا لا عينات ولا أرقام تجريبية.</p>
          </div>
        </section>

        <footer className="footer">
          <a className="brand" style={{ color: "var(--navy)", fontSize: 16 }} href="/"><span style={{ fontWeight: 300 }}>Economy</span> <b style={{ color: "var(--gold)" }}>Week</b></a>
          <div className="links">
            <span>المنهجيات</span><span>سجل المراجعات</span><span>المصادر والترخيص</span><span>API</span><span>عن المنصة</span>
          </div>
          <span>ساما بالإسناد · بيانات الأسواق مؤجلة ~15 دقيقة (Yahoo Finance) · {now.getFullYear()}</span>
        </footer>
      </main>
    </>
  );
}
