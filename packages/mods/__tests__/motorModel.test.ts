import { describe, it, expect } from 'vitest';
import { windingImpedance } from '../src/_shared/motorModel';

describe('Мотор: windingImpedance', () => {
  it('1-ф: 1000 Вт, η=0.85, cos φ=0.8, 220В → I=6.69А', () => {
    const w = windingImpedance({ Pout: 1000, eta: 0.85, cosPhi: 0.8, Uw: 220, phases: 1 });
    expect(w.I).toBeCloseTo(6.69, 1);
    expect(w.Pin).toBeCloseTo(1176, 0);
    expect(w.R).toBeCloseTo(26.3, 1);
    expect(w.L * 1000).toBeCloseTo(62.9, 0);
  });

  it('3-ф Y: 5.5 кВт, η=0.88, cos φ=0.85, U_лин=380 → I_лин=11.17А', () => {
    // Для Y фазное напряжение на обмотке = U_лин / √3
    const Uw = 380 / Math.sqrt(3);
    const w = windingImpedance({ Pout: 5500, eta: 0.88, cosPhi: 0.85, Uw, phases: 3 });
    expect(w.I).toBeCloseTo(11.17, 1);
  });

  it('3-ф Δ: 5.5 кВт, η=0.88, cos φ=0.85, U_лин=380 → I_лин=11.17А', () => {
    // Для Δ фазное напряжение = U_лин, но ток обмотки = I_лин/√3.
    // windingImpedance считает ток через ОДНУ обмотку. Для Δ это I_лин/√3.
    const w = windingImpedance({ Pout: 5500, eta: 0.88, cosPhi: 0.85, Uw: 380, phases: 3 });
    expect(w.I * Math.sqrt(3)).toBeCloseTo(11.17, 1);
  });
});
