import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans_Arabic } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex",
});

// خط هوية «عام الحرف اليدوية 2025» — لعناوين صفحة «قريبًا».
const handicrafts = localFont({
  src: [
    { path: "../../public/fonts/TheYearofHandicrafts-Regular.otf", weight: "400" },
    { path: "../../public/fonts/TheYearofHandicrafts-Medium.otf", weight: "500" },
    { path: "../../public/fonts/TheYearofHandicrafts-SemiBold.otf", weight: "600" },
    { path: "../../public/fonts/TheYearofHandicrafts-Bold.otf", weight: "700" },
    { path: "../../public/fonts/TheYearofHandicrafts-Black.otf", weight: "900" },
  ],
  variable: "--font-hand",
  display: "swap",
});

// جروتيسك تحريري للعلامة الإنجليزية.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["300", "800"],
  variable: "--font-bricolage",
});

export const metadata: Metadata = {
  title: "Economy Week — قريبًا",
  description: "قريبًا — الاقتصاد السعودي من مصدره. بيانات رسمية، قصص اقتصادية، ورؤية أسبوعية أوضح. الرقم الرسمي، مفهومًا، كل أسبوع.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${plex.className} ${plex.variable} ${handicrafts.variable} ${bricolage.variable}`}>{children}</body>
    </html>
  );
}
