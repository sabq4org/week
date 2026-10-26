import type { Metadata } from "next";
import OpsRoom from "@/components/opsroom/OpsRoom";

// Economy Now — الرئيسية الفعلية بعد الإطلاق. تبقى على /now بينما تعرض / صفحة «قريبًا».
// ديناميكية بالكامل: البناء على Render يجري بلا DATABASE_URL فلا يمكن التصيير المسبق. عند توفر المتغيّر
// في بيئة البناء يمكن العودة إلى ISR (revalidate = 300).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Economy Now — ماذا تغيّر في اقتصاد السعودية الآن؟",
  description: "غرفة عمليات الاقتصاد السعودي: الإشارة الأعلى الآن، نقاط البيع الأسبوعية، مانشيتات الأرقام، وما صدر رسميًا — كل رقم بمصدره ووقت جلبه.",
};

export default function NowPage() {
  return <OpsRoom />;
}
