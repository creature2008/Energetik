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
  ],
  stamp({ comp, node }) {
    const a = node('L'), b = node('N');
    if (a == null || b == null) return [];
    const R = (comp.params.voltage ** 2) / comp.params.power;
    return [{ type: 'resistor', nodeA: a, nodeB: b, R }];
  },
  evaluate({ volts, current, comp }) {
    const dv = Math.abs(volts('L', 'N'));
    const vNom = comp.params.voltage || 220;
    const ratio = Math.min(Math.pow(dv / vNom, 2), 1);
    return { visual: { glow: ratio, label: dv.toFixed(0) + 'В · ' + current.toFixed(2) + 'А' } };
  },
};
