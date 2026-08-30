import { Spark } from "@/components/Spark";
import { StoryChart } from "@/components/StoryChart";
import {
  STRIP_CODES, buildStory, calendar, getMetricCards, latestIssue, releases, sourceHealth, topChanges,
} from "@/lib/home";
import { fmtDay, fmtMonthYear, fmtNum, fmtRelative } from "@/lib/format";

export const revalidate = 300;

const AR_MONTHS_SHORT = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default async function Home() {
  const cards = await getMetricCards();
  const strip = STRIP_CODES.map((c) => cards.find((x) => x.code === c)).filter((x) => x !== undefined);
  const story = buildStory(cards);
  const changes = topChanges(cards, 5);
  const rel = releases(cards.filter((c) => c.unit === "%"));
  const cal = calendar(cards);
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
          {strip.map((c) => (
            <div className="strip-cell" key={c.code} title={c.definitionAr ?? undefined}>
              <div className="strip-head">
                <span>{c.shortAr}</span>
                <span className={`dot ${c.fresh ? "ok" : "wait"}`} title={c.fresh ? "محدّث ضمن الإيقاع المتوقع" : "تجاوز الإيقاع المتوقع"} />
              </div>
              <div className="strip-val num">
                <b>{c.valueText}</b>
                <span>{c.unit === "%" ? fmtMonthYear(c.period) : "ريال/وحدة"}</span>
              </div>
              <div className="strip-foot">
                {c.staleDays ? (
                  <span className="waiting">بانتظار التحديث</span>
                ) : (
                  <span className={`num ${c.deltaTone}`}>{c.deltaText ?? "بلا تغيّر"}</span>
                )}
                <Spark points={c.spark.slice(-12)} color={c.deltaTone === "bad" ? "#B4432B" : c.deltaTone === "good" ? "#0E6E63" : "#C9A227"} />
              </div>
            </div>
          ))}
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
                  المصدر: البنك المركزي السعودي · جُلب {story.metric.fetchedAt ? fmtRelative(story.metric.fetchedAt) : "—"} · الصياغة قوالب حتمية فوق أرقام محسوبة — لا نموذج لغوي
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
                    <div className="top5-s">{c.unit === "%" ? fmtMonthYear(c.period) : fmtDay(c.period)} · ساما</div>
                  </span>
                  <span className={`top5-d num ${c.deltaTone}`}>{c.deltaText}</span>
                </li>
              ))}
            </ol>
            <div className="more">المنهجية: ترتيب بالتغير النسبي المطلق — بلا اجتهاد تحريري</div>
          </aside>
        </div>

        <div className="row3">
          <section>
            <div className="col-head"><b>أهم حركة عقارية</b><span>Real Estate Lab</span></div>
            <div className="card re-plan">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="li-t">قيد الربط بمصدر وزارة العدل</span>
                <span className="pill gold">المرحلة القادمة</span>
              </div>
              <p>
                مختبر العقار يعرض هنا صفقات المدن والأحياء بالوسيط والسعر للمتر ومستوى ثقة العينة،
                من بيانات وزارة العدل اليومية بعد التنظيف وإزالة التكرارات — لا نعرض رقمًا عقاريًا
                قبل اجتياز بوابة الجودة المنصوص عليها في وثيقة التأسيس.
              </p>
              <p style={{ color: "var(--navy)", fontWeight: 600 }}>ما يظهر في هذه الصفحة اليوم أرقام رسمية حية فقط — لا عينات ولا أرقام تجريبية.</p>
            </div>
          </section>

          <section>
            <div className="col-head"><b>ما صدر من الجهات</b><span>مرتب حسب حداثة الفترة</span></div>
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

          <section>
            <div className="col-head"><b>تقويم الإصدارات</b><span>محسوب من إيقاع كل مؤشر</span></div>
            <div className="card list-card">
              {cal.map((c, i) => {
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
            <div className="bignum num">{issue?.numberOfWeekValue ?? (strip[0] ? strip[0].valueText : "—")}</div>
            <p>{issue?.numberOfWeekNote ?? (strip[0] ? `${strip[0].titleAr} في ${fmtMonthYear(strip[0].period)} — كما نشره البنك المركزي.` : "")}</p>
          </div>
          <div className="cell">
            <div className="k">من الوثيقة المؤسِّسة</div>
            <p style={{ fontSize: 15, color: "#fff", fontWeight: 600, lineHeight: 1.8 }}>
              «الرقم الرسمي، مفهومًا، كل أسبوع.»
            </p>
            <p>الحسابات برمجية حتمية، والمصدر معلن على كل بطاقة، والقيم المنقّحة تبقى مراجعات لا استبدالًا.</p>
          </div>
        </section>

        <footer className="footer">
          <a className="brand" style={{ color: "var(--navy)", fontSize: 16 }} href="/"><span style={{ fontWeight: 300 }}>Economy</span> <b style={{ color: "var(--gold)" }}>Week</b></a>
          <div className="links">
            <span>المنهجيات</span><span>سجل المراجعات</span><span>المصادر والترخيص</span><span>API</span><span>عن المنصة</span>
          </div>
          <span>كل رقم له مصدر ووقت جلب ومنهجية · بيانات البنك المركزي السعودي تُعرض بالإسناد · {now.getFullYear()}</span>
        </footer>
      </main>
    </>
  );
}
