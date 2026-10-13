/** Numéro tunisien -> "+216XXXXXXXX", ou null s'il est invalide. */
export function normalizeTnPhone(input: string): string | null {
  const d = input.replace(/[\s().-]/g, "");
  if (/^\d{8}$/.test(d)) return `+216${d}`;
  if (/^(\+|00)?216\d{8}$/.test(d)) return `+216${d.slice(-8)}`;
  return null;
}
