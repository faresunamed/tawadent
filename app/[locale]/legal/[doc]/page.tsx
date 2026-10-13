import { notFound } from "next/navigation";
import { LOCALES, isLocale } from "@/lib/i18n";
import { LEGAL, LEGAL_KEYS, type LegalKey } from "@/content/legal";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => LEGAL_KEYS.map((doc) => ({ locale, doc })));
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !LEGAL_KEYS.includes(doc as LegalKey)) notFound();
  const content = LEGAL[doc as LegalKey][locale];

  return (
    <div className="container page legal">
      <h1>{content.title}</h1>
      <p className="draft-note">{content.draft}</p>
      {content.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
