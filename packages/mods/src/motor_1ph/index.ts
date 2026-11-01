import type { DeviceMod } from '@electro/core';
export const motor_1ph: DeviceMod = {
  id: 'motor_1ph', name: 'Мотор 1-ф', category: 'motors',
  size: { w: 80, h: 60 },
  icon: 'motor_1ph.svg',
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [
    { key: 'power', label: 'Мощность (Вт)', type: 'number', default: 1000 },
    { key: 'startupMultiplier', label: 'Пусковой ток (×ном.)', type: 'number', default: 6 },
  ],
  stamp({ comp, node }) {
    const a = node('L'), b = node('N');
    if (a == null || b == null) return [];
    return [{ type: 'resistor', nodeA: a, nodeB: b, R: (220 * 220) / comp.params.power }];
  },
  evaluate({ volts }) {
    return { visual: { spinning: Math.abs(volts('L', 'N')) > 50 } };
  },
};
