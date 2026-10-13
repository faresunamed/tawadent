import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import DentistApp from "./DentistApp";

export default async function DentistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  return (
    <div className="container page">
      <h1>{t.dentist.title}</h1>
      <DentistApp />
    </div>
  );
}
