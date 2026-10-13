import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="container page hero">
      <h1>{t.home.title}</h1>
      <p className="lead">{t.home.subtitle}</p>

      <div className="hero-actions">
        <Link href={`/${locale}/patient`} className="btn btn-danger btn-lg">
          {t.home.patientCta}
        </Link>
        <Link href={`/${locale}/dentiste`} className="btn btn-secondary btn-lg">
          {t.home.dentistCta}
        </Link>
      </div>

      <ol className="steps">
        {t.home.steps.map((s, i) => (
          <li key={s.title} className="card step">
            <span className="step-num" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <strong>{s.title}</strong>
              <p className="muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="notice-emergency">{t.home.emergency}</p>
      <p className="muted small">{t.home.notMedical}</p>
    </div>
  );
}
