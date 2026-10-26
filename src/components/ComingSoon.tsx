"use client";

import { useState, useSyncExternalStore } from "react";
import SilkBackground from "./SilkBackground";
import styles from "./ComingSoon.module.css";

function subscribeToMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export default function ComingSoon() {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  return (
    <main className={styles.page}>
      <SilkBackground paused={paused || reducedMotion} />
      <div className={`${styles.topline} ${styles.enter}`} style={{ animationDelay: ".05s" }}>اقتصــاد السعودية، بصورة أوضــح.</div>
      <section className={styles.hero} aria-labelledby="coming-title">
        <div className={`${styles.wordmark} ${styles.enter}`} style={{ animationDelay: ".12s" }} dir="ltr" aria-label="Economy Week">
          <span>Economy</span>
          <strong>WEEK</strong>
        </div>
        <div className={`${styles.divider} ${styles.enter}`} style={{ animationDelay: ".22s" }} aria-hidden="true" />
        <h1 id="coming-title" className={styles.enter} style={{ animationDelay: ".3s" }}>قريـــبًا</h1>
        <p className={styles.enter} style={{ animationDelay: ".4s" }}>الرقــم الرسمي، مفهومًا، كل أســبوع.</p>
      </section>
      <footer className={`${styles.footer} ${styles.enter}`} style={{ animationDelay: ".55s" }}>
        <p className={styles.pillars}>بيانات رسمية<span />قصص اقتصادية<span />رؤية أسبوعية</p>
        <button className={styles.motionButton} type="button" onClick={() => setPaused((value) => !value)} disabled={reducedMotion} aria-pressed={paused || reducedMotion}>
          <span aria-hidden="true">{paused || reducedMotion ? "▷" : "Ⅱ"}</span>
          {reducedMotion ? "الحركة مخفّضة" : paused ? "تشغيل الحركة" : "إيقاف الحركة"}
        </button>
      </footer>
    </main>
  );
}
