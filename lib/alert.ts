/** Bip sonore court (les navigateurs l'autorisent après une première interaction avec la page). */
export function beep(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 450);
  } catch {
    /* son indisponible : sans importance */
  }
}
