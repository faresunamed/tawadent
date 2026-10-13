"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/useLocale";

export default function Header() {
  const { t, locale } = useT();
  const pathname = usePathname() || `/${locale}`;
  const other = locale === "fr" ? "ar" : "fr";
  const rest = pathname.replace(/^\/(fr|ar)/, "");
  const switchHref = `/${other}${rest}`;

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link href={`/${locale}`} className="brand" aria-label={t.brand}>
          <img src="/logo.svg" alt="" width={32} height={32} />
          <span>{t.brand}</span>
        </Link>
        <nav className="nav" aria-label="Navigation">
          <Link href={`/${locale}/patient`}>{t.nav.patient}</Link>
          <Link href={`/${locale}/dentiste`}>{t.nav.dentist}</Link>
          <Link href={switchHref} className="lang" hrefLang={other} lang={other}>
            {other === "ar" ? "العربية" : "Français"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
