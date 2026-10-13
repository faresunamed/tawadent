"use client";

import Link from "next/link";
import { useT } from "@/lib/useLocale";

export default function Footer() {
  const { t, locale } = useT();
  return (
    <footer className="site-footer">
      <div className="container footer-row">
        <span>{t.footer}</span>
        <span className="footer-links">
          <Link href={`/${locale}/legal/privacy`}>{t.nav.privacy}</Link>
          <Link href={`/${locale}/legal/terms`}>{t.nav.terms}</Link>
        </span>
      </div>
    </footer>
  );
}
