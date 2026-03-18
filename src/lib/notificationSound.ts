/**
 * Plays a soft "pop/bounce" notification sound using Web Audio API.
 * No external file required — fully synthesised in-browser.
 */
export function playMessageSound(): void {
  try {
    const ctx = new AudioContext();

    // Oscillator — sine wave for a soft tone
    const osc = ctx.createOscillator();
    // Gain — controls volume envelope
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";

    const now = ctx.currentTime;

    // Pitch: quick upward bounce 520 Hz → 680 Hz
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);

    // Volume envelope: soft attack → quick decay (total ~150 ms)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.015); // attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15); // decay

    osc.start(now);
    osc.stop(now + 0.15);

    // Clean up AudioContext after sound finishes
    osc.onended = () => ctx.close();
  } catch {
    // Silently ignore — Web Audio may be blocked in some environments
  }
}
