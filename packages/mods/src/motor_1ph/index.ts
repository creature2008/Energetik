import type { DeviceMod } from '@electro/core';
import { windingImpedance } from '../_shared/motorModel';

export const motor_1ph: DeviceMod = {
  id: 'motor_1ph', name: 'Мотор 1-ф', category: 'motors',
  size: { w: 80, h: 60 }, icon: 'motor_1ph.svg',
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [
    { key: 'power', label: 'Мощность (Вт)', type: 'number', default: 1000 },
    { key: 'efficiency', label: 'КПД (%)', type: 'number', default: 85 },
    { key: 'cosPhi', label: 'cos φ', type: 'number', default: 0.8 },
    { key: 'startupMultiplier', label: 'Пусковой ток (×ном.)', type: 'number', default: 6 },
    { key: 'grounded', label: 'Заземлён', type: 'boolean', default: true },
    { key: 'leakage', label: 'Утечка (мА)', type: 'number', default: 0 },
  ],
  stamp({ comp, node }) {
    const a = node('L'), b = node('N');
    if (a == null || b == null) return [];
    const Pout = comp.params.power || 1000;
    const eta = (comp.params.efficiency || 85) / 100;
    const cosPhiRun = comp.params.cosPhi || 0.8;
    const cosPhiStart = 0.4;
    const k = comp.params.startupMultiplier || 6;
    const isStarting = comp.params.startup === true;

    let R: number, L: number;
    if (isStarting) {
      // Пусковой режим: |Z_start| = |Z_run| / k, cos φ пуска ≈ 0.4
      const run = windingImpedance({ Pout, eta, cosPhi: cosPhiRun, Uw: 220, phases: 1 });
      const Z_start = run.Z_mag / k;
      const R_start = Z_start * cosPhiStart;
      const X_start = Z_start * Math.sqrt(1 - cosPhiStart * cosPhiStart);
      R = R_start;
      L = X_start / (2 * Math.PI * 50);
    } else {
      const run = windingImpedance({ Pout, eta, cosPhi: cosPhiRun, Uw: 220, phases: 1 });
      R = run.R;
      L = run.L;
    }
    return [{ type: 'inductor', nodeA: a, nodeB: b, L, esr: R }];
  },
  evaluate({ volts, current, comp }) {
    const isStarting = comp.params.startup === true;
    return { visual: { spinning: Math.abs(volts('L', 'N')) > 50, tint: isStarting ? '#f39c12' : undefined } };
  },
};
