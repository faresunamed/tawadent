import Link from "next/link";
import "./globals.css";

export default function NotFound() {
  return (
    <html lang="fr">
      <body>
        <main className="container page">
          <h1>404</h1>
          <p className="muted">Page introuvable · الصفحة غير موجودة</p>
          <p>
            <Link href="/fr">Accueil</Link> · <Link href="/ar">الرئيسية</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
