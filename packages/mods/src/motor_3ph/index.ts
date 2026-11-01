import type { DeviceMod } from '@electro/core';
export const motor_3ph: DeviceMod = {
  id: 'motor_3ph', name: 'Мотор 3-ф', category: 'motors',
  size: { w: 80, h: 60 },
  pins: [
    { id: 'L1', label: 'L1', side: 'left', color: '#fff' },
    { id: 'L2', label: 'L2', side: 'left', color: '#fff' },
    { id: 'L3', label: 'L3', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [
    { key: 'power', label: 'Мощность (Вт)', type: 'number', default: 3000 },
    { key: 'startupMultiplier', label: 'Пусковой ток (×ном.)', type: 'number', default: 7 },
  ],
  stamp({ comp, node }) {
    const a = node('L1'), b = node('N');
    if (a == null || b == null) return [];
    return [{ type: 'resistor', nodeA: a, nodeB: b, resistance: (380 * 380) / comp.params.power }];
  },
  evaluate({ comp, volts }) {
    const dv = Math.abs(volts('L1', 'N'));
    return { visual: { spinning: dv > 50, label: 'M 3~' } };
  },
};
