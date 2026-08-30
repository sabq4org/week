import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Economy Week — الرقم الرسمي، مفهومًا، كل أسبوع",
  description: "بوابة البيانات الاقتصادية السعودية: مؤشرات رسمية حية من البنك المركزي، قصص بيانات، ومؤشرات خاصة — كل رقم له مصدر ووقت جلب ومنهجية.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={plex.className}>{children}</body>
    </html>
  );
}
