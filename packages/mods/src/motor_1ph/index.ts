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
    const { R, L } = windingImpedance({
      Pout: comp.params.power || 1000,
      eta: (comp.params.efficiency || 85) / 100,
      cosPhi: comp.params.cosPhi || 0.8,
      Uw: 220,
      phases: 1,
    });
    return [{ type: 'inductor', nodeA: a, nodeB: b, L, esr: R }];
  },
  evaluate({ volts }) {
    return { visual: { spinning: Math.abs(volts('L', 'N')) > 50 } };
  },
};
