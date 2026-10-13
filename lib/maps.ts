type Place = { latitude: number | null; longitude: number | null; address: string };

/** Lien d'itinéraire : coordonnées GPS si elles existent, sinon l'adresse. */
export function directionsUrl(p: Place): string {
  const destination =
    p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : p.address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Numéro utilisable dans un lien tel: (garde chiffres et +). */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
