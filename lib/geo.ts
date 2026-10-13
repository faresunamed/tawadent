import { ZONES, type Zone } from "./zones";

/** Distance entre deux points (formule de Haversine), en km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Zone pilote la plus proche, ou null si on est à plus de `maxKm` de toutes. */
export function nearestZone(lat: number, lng: number, maxKm = 5): Zone | null {
  let best: Zone | null = null;
  let bestD = Infinity;
  for (const z of ZONES) {
    const d = haversineKm(lat, lng, z.lat, z.lng);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best && bestD <= maxKm ? best : null;
}
