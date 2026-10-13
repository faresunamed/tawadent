import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import PatientApp from "./PatientApp";

export default async function PatientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  return (
    <div className="container page">
      <h1>{t.patient.title}</h1>
      <PatientApp />
    </div>
  );
}
