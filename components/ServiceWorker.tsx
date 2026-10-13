"use client";

import { useEffect } from "react";

/** Enregistre le service worker (nécessaire pour l'installation sur l'écran d'accueil). */
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
