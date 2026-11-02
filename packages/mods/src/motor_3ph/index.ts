import type { DeviceMod } from '@electro/core';
import { windingImpedance } from '../_shared/motorModel';

export const motor_3ph: DeviceMod = {
  id: 'motor_3ph', name: 'Мотор 3-ф', category: 'motors',
  size: { w: 80, h: 60 }, icon: 'motor_3ph.svg',
  pins: [
    { id: 'L1', label: 'L1', side: 'left', color: '#fff' },
    { id: 'L2', label: 'L2', side: 'left', color: '#fff' },
    { id: 'L3', label: 'L3', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [
    { key: 'power', label: 'Мощность (Вт)', type: 'number', default: 3000 },
    { key: 'efficiency', label: 'КПД (%)', type: 'number', default: 88 },
    { key: 'cosPhi', label: 'cos φ', type: 'number', default: 0.85 },
    { key: 'connection', label: 'Схема', type: 'select', default: 'Y', options: [
      { value: 'Y', label: 'Звезда (Y)' },
      { value: 'D', label: 'Треугольник (Δ)' },
    ]},
    { key: 'startupMultiplier', label: 'Пусковой ток (×ном.)', type: 'number', default: 7 },
    { key: 'grounded', label: 'Заземлён', type: 'boolean', default: true },
    { key: 'leakage', label: 'Утечка (мА)', type: 'number', default: 0 },
  ],
  stamp({ comp, node }) {
    const isY = comp.params.connection !== 'D';
    const Uw = isY ? 380 / Math.sqrt(3) : 380;
    const Pout = comp.params.power || 3000;
    const eta = (comp.params.efficiency || 88) / 100;
    const cosPhiRun = comp.params.cosPhi || 0.85;
    const cosPhiStart = 0.4;
    const k = comp.params.startupMultiplier || 7;
    const isStarting = comp.params.startup === true;

    const run = windingImpedance({ Pout, eta, cosPhi: cosPhiRun, Uw, phases: 3 });
    let R: number, L: number;
    if (isStarting) {
      const Z_start = run.Z_mag / k;
      R = Z_start * cosPhiStart;
      const X = Z_start * Math.sqrt(1 - cosPhiStart * cosPhiStart);
      L = X / (2 * Math.PI * 50);
    } else {
      R = run.R;
      L = run.L;
    }

    const els: any[] = [];
    if (isY) {
      const nN = node('N');
      if (nN == null) return [];
      for (const ph of ['L1', 'L2', 'L3']) {
        const a = node(ph);
        if (a != null) els.push({ type: 'inductor', nodeA: a, nodeB: nN, L, esr: R });
      }
    } else {
      const pairs: [string, string][] = [['L1', 'L2'], ['L2', 'L3'], ['L3', 'L1']];
      for (const [p1, p2] of pairs) {
        const a = node(p1), b = node(p2);
        if (a != null && b != null) els.push({ type: 'inductor', nodeA: a, nodeB: b, L, esr: R });
      }
    }
    return els;
  },
  evaluate({ volts, comp }) {
    const isY = comp.params.connection !== 'D';
    let avg: number;
    if (isY) {
      avg = (Math.abs(volts('L1', 'N')) + Math.abs(volts('L2', 'N')) + Math.abs(volts('L3', 'N'))) / 3;
    } else {
      avg = (Math.abs(volts('L1', 'L2')) + Math.abs(volts('L2', 'L3')) + Math.abs(volts('L3', 'L1'))) / 3;
    }
    const isStarting = comp.params.startup === true;
    return { visual: { spinning: avg > 50, tint: isStarting ? '#f39c12' : undefined } };
  },
};
