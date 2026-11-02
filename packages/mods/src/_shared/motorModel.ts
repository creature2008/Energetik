export type WindingParams = {
  Pout: number;      // выходная мощность на валу
  eta: number;       // КПД (0.85 = 85%)
  cosPhi: number;    // коэффициент мощности (0.8)
  Uw: number;        // напряжение на обмотке
  phases: 1 | 3;     // количество фаз (1 или 3)
};

export type WindingResult = {
  R: number;       // активное сопротивление обмотки
  L: number;       // индуктивность
  Z_mag: number;   // полное сопротивление |Z|
  I: number;       // рабочий ток через обмотку
  Pin: number;     // потребляемая мощность из сети
};

/**
 * Расчёт импеданса обмотки асинхронного мотора.
 * P_in = P_out / η, S = P_in / cos φ, I = S / (phases × Uw).
 * Z = Uw / I (для одной обмотки), R = Z·cos φ, X = Z·sin φ, L = X / (2πf).
 */
export function windingImpedance(p: WindingParams, fRated = 50): WindingResult {
  const Pin = p.Pout / p.eta;
  const S = Pin / p.cosPhi;
  const Sw = S / p.phases;
  const I = Sw / p.Uw;
  const Z_mag = p.Uw / I;
  const R = Z_mag * p.cosPhi;
  const X = Z_mag * Math.sqrt(Math.max(0, 1 - p.cosPhi * p.cosPhi));
  const L = X / (2 * Math.PI * fRated);
  return { R, L, Z_mag, I, Pin };
}
