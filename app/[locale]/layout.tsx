import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { LOCALES, dirOf, getDict, isLocale } from "@/lib/i18n";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceWorker from "@/components/ServiceWorker";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale);
  return {
    title: { default: `TawaDent · ${t.tagline}`, template: "%s · TawaDent" },
    description: t.home.subtitle,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/logo.svg", apple: "/icons/icon-192.png" },
    appleWebApp: { capable: true, title: "TawaDent", statusBarStyle: "default" },
    alternates: { languages: { fr: "/fr", ar: "/ar" } },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        <ServiceWorker />
      </body>
    </html>
  );
}
