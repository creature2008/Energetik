import type { DeviceMod } from '@electro/core';
export const motor_1ph: DeviceMod = {
  id: 'motor_1ph', name: 'Мотор 1-ф', category: 'motors',
  size: { w: 80, h: 60 },
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [{ key: 'power', label: 'Мощность (Вт)', type: 'number', default: 1000 }],
  stamp({ comp, node }) {
    const a = node('L'), b = node('N');
    if (a == null || b == null) return [];
    return [{ type: 'resistor', nodeA: a, nodeB: b, resistance: (220 * 220) / comp.params.power }];
  },
  evaluate({ volts }) {
    const dv = Math.abs(volts('L', 'N'));
    return { visual: { spinning: dv > 50, label: 'M 1~' } };
  },
};
