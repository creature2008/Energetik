import type { DeviceMod } from '@electro/core';
export const lamp: DeviceMod = {
  id: 'lamp', name: 'Лампа', category: 'light',
  size: { w: 80, h: 60 }, icon: 'lamp.svg',
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [
    { key: 'power', label: 'Мощность (Вт)', type: 'number', default: 100 },
    { key: 'voltage', label: 'Напряжение (В)', type: 'number', default: 220 },
    { key: 'grounded', label: 'Заземлён', type: 'boolean', default: true },
    { key: 'leakage', label: 'Утечка (мА)', type: 'number', default: 0 },
  ],
  stamp({ comp, node }) {
    const a = node('L'), b = node('N');
    if (a == null || b == null) return [];
    const R = (comp.params.voltage ** 2) / comp.params.power;
    return [{ type: 'resistor', nodeA: a, nodeB: b, R }];
  },
  evaluate({ volts, comp }) {
    const dv = Math.abs(volts('L', 'N'));
    const vNom = comp.params.voltage || 220;
    const ratio = Math.min(Math.pow(dv / vNom, 2), 1);
    // Если напряжение больше номинала на 10% - предупреждение
    const warning = dv > vNom * 1.1;
    return { visual: { glow: ratio, warning } };
  },
};
