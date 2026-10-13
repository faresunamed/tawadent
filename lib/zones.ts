export type Zone = { id: string; fr: string; ar: string };

// Zone pilote : doit rester identique à la table `zones` (vérifié par un test).
export const ZONES: Zone[] = [
  { id: "ariana", fr: "Ariana", ar: "أريانة" },
  { id: "ennasr", fr: "Ennasr", ar: "النصر" },
  { id: "el-menzah", fr: "El Menzah", ar: "المنزه" },
  { id: "el-manar", fr: "El Manar", ar: "المنار" },
  { id: "centre-urbain-nord", fr: "Centre Urbain Nord", ar: "المركز العمراني الشمالي" },
  { id: "lac-1", fr: "Lac 1", ar: "البحيرة 1" },
  { id: "lac-2", fr: "Lac 2", ar: "البحيرة 2" },
  { id: "jardins-de-carthage", fr: "Jardins de Carthage", ar: "حدائق قرطاج" },
  { id: "ain-zaghouan", fr: "Aïn Zaghouan", ar: "عين زغوان" },
  { id: "carthage", fr: "Carthage", ar: "قرطاج" },
  { id: "la-marsa", fr: "La Marsa", ar: "المرسى" },
  { id: "sidi-bou-said", fr: "Sidi Bou Saïd", ar: "سيدي بوسعيد" },
  { id: "gammarth", fr: "Gammarth", ar: "قمرت" },
  { id: "la-soukra", fr: "La Soukra", ar: "السكرة" },
  { id: "el-aouina", fr: "El Aouina", ar: "العوينة" },
];

export function zoneName(id: string, locale: "fr" | "ar"): string {
  const z = ZONES.find((z) => z.id === id);
  return z ? z[locale] : id;
}
