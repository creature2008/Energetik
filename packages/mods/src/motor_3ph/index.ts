import type { DeviceMod } from '@electro/core';
export const motor_3ph: DeviceMod = {
  id: 'motor_3ph', name: 'Мотор 3-ф', category: 'motors',
  size: { w: 80, h: 60 },
  icon: 'motor_3ph.svg',
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
    const R = (220 * 220) / (comp.params.power / 3);
    const els = [];
    const nN = node('N');
    for (const ph of ['L1', 'L2', 'L3']) {
      const nPh = node(ph);
      if (nPh != null && nN != null) els.push({ type: 'resistor', nodeA: nPh, nodeB: nN, R });
    }
    return els;
  },
  evaluate({ volts }) {
    const avg = (Math.abs(volts('L1', 'N')) + Math.abs(volts('L2', 'N')) + Math.abs(volts('L3', 'N'))) / 3;
    return { visual: { spinning: avg > 50 } };
  },
};
