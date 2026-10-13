import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import AdminApp from "./AdminApp";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  return (
    <div className="container page">
      <h1>{t.admin.title}</h1>
      <AdminApp />
    </div>
  );
}
