// Service worker minimal : rend l'application installable sur l'écran d'accueil.
// Aucune mise en cache volontaire : les disponibilités des cabinets doivent toujours être à jour.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  /* réseau direct */
});

// Prêt pour les notifications push (étape suivante : Firebase Cloud Messaging / Web Push).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || "TawaDent", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      data: { url: data.url || "/fr/dentiste" },
      requireInteraction: true,
    })
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});
