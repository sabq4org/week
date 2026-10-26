/**
 * Economy Now — «غرفة العمليات»: مشهد واحد حيّ تقوده الإشارات لا الأقسام.
 * كل رقم من قاعدة البيانات عبر src/lib/home.ts؛ الترتيب والحسابات حتمية، والقوالب النصية تُحقن بأرقام محسوبة.
 */
import SilkBackground from "@/components/SilkBackground";
import { Spark } from "@/components/Spark";
import {
  buildDailyBrief, buildHeadlines, buildStory, calendar, getMetricCards, getPosWeek, officialNewsFeed,
  posHeadline, sourceHealth, topChanges, type MetricCard,
} from "@/lib/home";
import { fmtCompact, fmtDay, fmtMonthYear, fmtNum, fmtRelative } from "@/lib/format";
import { WEEKDAYS_AR, daysUntilThursday, recentWeeks } from "@/lib/weeks";
import { HeroChart } from "./HeroChart";
import s from "./OpsRoom.module.css";

const TONE_COLOR = { good: "#7FD6C8", bad: "#F08A6E", flat: "#E7D7A8" } as const;

function sourceOf(c: MetricCard) {
  return c.code.startsWith("mkt.") ? "Yahoo Finance · مؤجل ~15 دقيقة" : "البنك المركزي السعودي";
}
function compactOf(c: MetricCard) {
  return fmtCompact(c.value, c.unit, c.code, c.valueText);
}
/** النسبة المئوية للتغير بين آخر قراءتين، أو null إن تعذّر حسابها. */
function deltaPct(c: MetricCard): number | null {
  if (c.delta == null || c.spark.length < 2) return null;
  const prev = c.spark[c.spark.length - 2].value;
  return prev ? (c.delta / prev) * 100 : null;
}

export default async function OpsRoom() {
  const cards = await getMetricCards();
  const changes = topChanges(cards, 5);
  const hero = changes[0] ?? cards[0] ?? null;
  const stream = changes.slice(1);
  const story = buildStory(cards);
  const brief = buildDailyBrief(cards);
  const headlines = buildHeadlines(cards).slice(0, 4);
  const [pos, news, health] = await Promise.all([getPosWeek(), officialNewsFeed(4), sourceHealth(cards)]);
  const posHead = pos ? posHeadline(pos) : null;
  const cal = calendar(cards).slice(0, 4);
  const now = new Date();
  const weeks = recentWeeks(now, 10);
  const toThu = daysUntilThursday(now);
  const heroPct = hero ? deltaPct(hero) : null;
  const heroWhy = hero && story && story.metric.code === hero.code ? { h: "لماذا يهم؟", p: story.why } : { h: "ما هذا المؤشر؟", p: hero?.definitionAr ?? "التعريف والمنهجية في صفحة المؤشر." };

  return (
    <div className={s.stage} data-tone={hero?.deltaTone ?? "flat"}>
      <div className={s.backdrop} aria-hidden="true"><SilkBackground /><div className={s.dim} /></div>

      <header className={s.bar}>
        <a className={s.brand} href="/" dir="ltr"><span>Economy</span><b>WEEK</b></a>
        <div className={s.ask} aria-label="اسأل الرقم، قريبًا">
          <span className={s.askIcon} aria-hidden="true">؟</span>
          <span className={s.askText}>اسأل الرقم: كم تغيّر التمويل العقاري منذ 2024؟</span>
          <span className={s.askSoon}>قريبًا</span>
        </div>
        <div className={s.status} role="status">
          <span className={s.pulse} aria-hidden="true" />
          <span>
            آخر جلب {health.lastRun ? fmtRelative(health.lastRun) : "—"} · <b className="num">{health.updated}</b> مؤشرًا محدّثًا
            {health.pending > 0 && <> · <b className="num">{health.pending}</b> بانتظار الإصدار</>}
          </span>
        </div>
      </header>

      <main className={s.main}>
        {!hero && <p className={s.empty}>لا بيانات بعد. شغّل الجلب أولًا.</p>}

        {hero && (
          <section className={s.hero} aria-labelledby="hero-title">
            <div className={s.heroHead}>
              <span className={s.kicker}>الإشارة الأعلى الآن · {hero.periodLabel}</span>
              <span className={s.rankNote}>الترتيب بالتغير النسبي المطلق بين آخر قراءتين · بلا اجتهاد تحريري</span>
            </div>
            <div className={s.heroGrid}>
              <div>
                <div className={`${s.bigValue} num`}>{compactOf(hero).text}<small>{compactOf(hero).unit}</small></div>
                <h1 id="hero-title" className={s.heroTitle}>{hero.titleAr}</h1>
                <div className={s.deltaRow}>
                  <span className={`${s.delta} ${s[hero.deltaTone]} num`}>{hero.deltaText ?? "بلا تغيّر"}</span>
                  {heroPct != null && <span className={`${s.deltaPct} num`}>{heroPct >= 0 ? "+" : "−"}{fmtNum(Math.abs(heroPct))}% عن القراءة السابقة</span>}
                </div>
              </div>
              <HeroChart points={hero.spark} unit={hero.unit} tone={hero.deltaTone} />
            </div>
            <div className={s.heroText}>
              <div>
                <h2>ماذا حدث؟</h2>
                <p>
                  {hero.titleAr} عند {compactOf(hero).text} {compactOf(hero).unit} في {hero.periodLabel}، بتغيّر {hero.deltaText ?? "صفري"} عن القراءة السابقة
                  {hero.staleDays ? `، والقراءة التالية متأخرة ${hero.staleDays} يومًا عن إيقاع المصدر` : ""}.
                </p>
              </div>
              <div>
                <h2>{heroWhy.h}</h2>
                <p>{heroWhy.p}</p>
              </div>
              <div className={s.prov}>
                <span>المصدر: {sourceOf(hero)}</span>
                <span>جُلب {hero.fetchedAt ? fmtRelative(hero.fetchedAt) : "—"}</span>
                <span className={s.provActions}><span>رابط دائم</span><span>CSV</span><span>تضمين</span></span>
              </div>
            </div>
          </section>
        )}

        {brief && (
          <p className={s.brief}><b className={s.briefK}>موجز اليوم</b><span>{brief.text}</span><span className={s.briefS}>آليًا من حركة اليوم · {fmtRelative(brief.asOf)}</span></p>
        )}

        {stream.length > 0 && (
          <section className={s.streamWrap} aria-labelledby="stream-title">
            <div className={s.secHead}><h2 id="stream-title">ما يستحق الانتباه بعدها</h2><span>الإشارات التالية بالترتيب نفسه</span></div>
            <div className={s.stream}>
              {stream.map((c, i) => (
                <article className={s.signal} key={c.code}>
                  <div className={s.sigTop}><span className={`${s.rank} num`}>{i + 2}</span><span className={s.sigName}>{c.shortAr}</span><span className={`${s.dot} ${c.fresh ? s.ok : s.wait}`} title={c.fresh ? "محدّث" : "متأخر"} /></div>
                  <div className={`${s.sigValue} num`}>{compactOf(c).text}<small>{compactOf(c).unit}</small></div>
                  <div className={s.sigSpark}><Spark points={c.spark.slice(-18)} color={TONE_COLOR[c.deltaTone]} w={220} h={56} /></div>
                  <div className={s.sigFoot}><span className={`${s[c.deltaTone]} num`}>{c.deltaText}</span><span>{c.periodLabel}</span></div>
                  <div className={s.sigSrc}>{sourceOf(c)} · {c.fetchedAt ? fmtRelative(c.fetchedAt) : "—"}</div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className={s.twoCol}>
          {pos && posHead && (
            <section className={s.posCard} aria-labelledby="pos-title">
              <div className={s.secHead}><h2>أين راحت الفلوس؟</h2><span>أسبوع {pos.labelAr} · نقاط البيع</span></div>
              <h3 id="pos-title" className={s.posTitle}>{posHead.title}</h3>
              <p className={s.posSub}>{posHead.sub}</p>
              <div className={s.posKpis}>
                <div><b className="num">{fmtNum(pos.totalBillions, 1)}</b><span>مليار ريال</span></div>
                <div><b className={`num ${pos.dv >= 0 ? s.good : s.bad}`}>{pos.dv >= 0 ? "+" : "−"}{fmtNum(Math.abs(pos.dv))}%</b><span>أسبوعيًا</span></div>
                <div><b className="num">{fmtNum(pos.opsMillions, 1)}</b><span>مليون عملية</span></div>
              </div>
              <div className={s.bars}>
                {pos.sectors.slice(0, 6).map((sec) => (
                  <div className={s.barRow} key={sec.ar}>
                    <span className={s.barName}>{sec.ar}</span>
                    <span className={s.barTrack}><span style={{ width: `${Math.min(100, (sec.sharePct / (pos.sectors[0]?.sharePct || 1)) * 100)}%` }} /></span>
                    <span className={`${s.barVal} num`}>{fmtNum(sec.billions, 1)}</span>
                    <span className={`${s.barDv} num ${sec.dv >= 0 ? s.good : s.bad}`}>{sec.dv >= 0 ? "+" : "−"}{fmtNum(Math.abs(sec.dv), 1)}%</span>
                  </div>
                ))}
              </div>
              <div className={s.cities}>
                {pos.topCities.slice(0, 3).map((c, i) => (
                  <span key={c.ar}><b className="num">{i + 1}</b> {c.ar} <span className="num">{fmtNum(c.billions, 1)}</span></span>
                ))}
              </div>
              <div className={s.prov}>
                <span>المصدر: <a href={pos.sourceUrl} target="_blank" rel="noopener noreferrer">تقرير ساما الأسبوعي (PDF)</a> · جُلب {fmtRelative(pos.fetchedAt)}</span>
                <span className={s.provActions}><span>كل القطاعات</span><span>CSV</span></span>
              </div>
            </section>
          )}

          <aside className={s.rail}>
            {headlines.length > 0 && (
              <section className={s.railBlock} aria-labelledby="headlines-title">
                <div className={s.secHead}><h2 id="headlines-title">مانشيتات الأرقام</h2><span>من النشرة الشهرية · آليًا</span></div>
                <ul className={s.headlines}>
                  {headlines.map((h, i) => (
                    <li key={i}><span className={`${s.hDot} ${s[h.tone]}`} /><div><b>{h.title}</b><span>{h.sub}</span></div></li>
                  ))}
                </ul>
              </section>
            )}
            {news.length > 0 && (
              <section className={s.railBlock} aria-labelledby="news-title">
                <div className={s.secHead}><h2 id="news-title">صدر رسميًا</h2><span>البنك المركزي</span></div>
                <ul className={s.news}>
                  {news.map((n) => (
                    <li key={n.id}><span className={s.newsDate}>{fmtDay(n.publishedAt.toISOString().slice(0, 10))}</span><a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a></li>
                  ))}
                </ul>
              </section>
            )}
            {cal.length > 0 && (
              <section className={s.railBlock} aria-labelledby="cal-title">
                <div className={s.secHead}><h2 id="cal-title">القادم على التقويم</h2><span>محسوب من إيقاع كل مصدر</span></div>
                <ul className={s.cal}>
                  {cal.map((c, i) => {
                    const [y, m, d] = c.due.split("-").map(Number);
                    return (
                      <li key={i} className={c.lateDays ? s.late : undefined}>
                        <span className={s.calDay}>
                          <b className="num">{c.lateDays ? "!" : d}</b>
                          <span>{c.lateDays ? `متأخر ${c.lateDays} يوم` : fmtMonthYear(`${y}-${String(m).padStart(2, "0")}`).split(" ")[0]}</span>
                        </span>
                        <div><b>{c.titleAr}</b><span>{c.noteAr}</span></div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </main>

      <footer className={s.timeline} aria-label="شريط الأسابيع">
        <div className={s.tlHead}>
          <span>{WEEKDAYS_AR[now.getDay()]} · العدد الأول يُغلق الخميس بعد <b className="num">{toThu}</b> {toThu === 1 ? "يوم" : "أيام"}</span>
          <span>الأسبوع الحالي يسارًا والأقدم يمينًا</span>
        </div>
        <ol className={s.tlTrack}>
          {weeks.map((w, i) => (
            <li key={`${w}-${i}`} className={`${s.tick} ${i === weeks.length - 1 ? s.tickNow : ""}`} aria-current={i === weeks.length - 1 ? "date" : undefined}>
              <i /><b className="num">{w}</b>
            </li>
          ))}
        </ol>
        <div className={s.tlFoot}>ساما بالإسناد · الأسواق مؤجلة ~15 دقيقة (Yahoo Finance) · الحسابات حتمية والتفسير تحريري · {now.getFullYear()}</div>
      </footer>
    </div>
  );
}
