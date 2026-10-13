export type Zone = { id: string; fr: string; ar: string; lat: number; lng: number };

// Zone pilote : doit rester identique à la table `zones` (vérifié par un test).
export const ZONES: Zone[] = [
  { id: "ariana", fr: "Ariana", ar: "أريانة", lat: 36.8665, lng: 10.1647 },
  { id: "ennasr", fr: "Ennasr", ar: "النصر", lat: 36.8585, lng: 10.1509 },
  { id: "el-menzah", fr: "El Menzah", ar: "المنزه", lat: 36.8409, lng: 10.1772 },
  { id: "el-manar", fr: "El Manar", ar: "المنار", lat: 36.833, lng: 10.1466 },
  { id: "centre-urbain-nord", fr: "Centre Urbain Nord", ar: "المركز العمراني الشمالي", lat: 36.847, lng: 10.199 },
  { id: "lac-1", fr: "Lac 1", ar: "البحيرة 1", lat: 36.835, lng: 10.238 },
  { id: "lac-2", fr: "Lac 2", ar: "البحيرة 2", lat: 36.847, lng: 10.279 },
  { id: "jardins-de-carthage", fr: "Jardins de Carthage", ar: "حدائق قرطاج", lat: 36.852, lng: 10.288 },
  { id: "ain-zaghouan", fr: "Aïn Zaghouan", ar: "عين زغوان", lat: 36.863, lng: 10.273 },
  { id: "carthage", fr: "Carthage", ar: "قرطاج", lat: 36.853, lng: 10.323 },
  { id: "la-marsa", fr: "La Marsa", ar: "المرسى", lat: 36.878, lng: 10.324 },
  { id: "sidi-bou-said", fr: "Sidi Bou Saïd", ar: "سيدي بوسعيد", lat: 36.87, lng: 10.347 },
  { id: "gammarth", fr: "Gammarth", ar: "قمرت", lat: 36.91, lng: 10.3 },
  { id: "la-soukra", fr: "La Soukra", ar: "السكرة", lat: 36.884, lng: 10.246 },
  { id: "el-aouina", fr: "El Aouina", ar: "العوينة", lat: 36.86, lng: 10.254 },
];

export function zoneName(id: string, locale: "fr" | "ar"): string {
  const z = ZONES.find((z) => z.id === id);
  return z ? z[locale] : id;
}
