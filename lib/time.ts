/**
 * Secondes restantes à partir d'une valeur donnée par le serveur (`secondsLeft`)
 * et du moment où elle a été reçue (`receivedAt`, en ms). Cela évite toute
 * dépendance à l'horloge du téléphone du patient.
 */
export function remainingSeconds(secondsLeft: number, receivedAt: number, now: number = Date.now()): number {
  const elapsed = Math.floor((now - receivedAt) / 1000);
  return Math.max(0, secondsLeft - elapsed);
}

/** 75 -> "1:15", 5 -> "0:05" */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Minutes restantes (arrondies au supérieur) avant une date ISO. */
export function minutesUntil(iso: string | null, now: number = Date.now()): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}
