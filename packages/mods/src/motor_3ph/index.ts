import type { DeviceMod } from '@electro/core';
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
    { key: 'connection', label: 'Схема', type: 'select', default: 'Y', options: [
      { value: 'Y', label: 'Звезда (Y)' },
      { value: 'D', label: 'Треугольник (Δ)' },
    ]},
    { key: 'startupMultiplier', label: 'Пусковой ток (×ном.)', type: 'number', default: 7 },
    { key: 'grounded', label: 'Заземлён', type: 'boolean', default: true },
    { key: 'leakage', label: 'Утечка (мА)', type: 'number', default: 0 },
  ],
  stamp({ comp, node }) {
    const Pphase = comp.params.power / 3;
    const els: any[] = [];
    if (comp.params.connection === 'D') {
      // Треугольник: обмотки между фазами, 380В на каждой
      const R = (380 * 380) / Pphase;
      const pairs: [string, string][] = [['L1', 'L2'], ['L2', 'L3'], ['L3', 'L1']];
      for (const [a, b] of pairs) {
        const na = node(a), nb = node(b);
        if (na != null && nb != null) els.push({ type: 'resistor', nodeA: na, nodeB: nb, R });
      }
    } else {
      // Звезда: обмотки от фаз к N, 220В на каждой
      const R = (220 * 220) / Pphase;
      const nN = node('N');
      if (nN == null) return [];
      for (const ph of ['L1', 'L2', 'L3']) {
        const a = node(ph);
        if (a != null) els.push({ type: 'resistor', nodeA: a, nodeB: nN, R });
      }
    }
    return els;
  },
  evaluate({ volts, comp }) {
    const isDelta = comp.params.connection === 'D';
    let dv: number;
    if (isDelta) {
      dv = (Math.abs(volts('L1', 'L2')) + Math.abs(volts('L2', 'L3')) + Math.abs(volts('L3', 'L1'))) / 3;
    } else {
      dv = (Math.abs(volts('L1', 'N')) + Math.abs(volts('L2', 'N')) + Math.abs(volts('L3', 'N'))) / 3;
    }
    return { visual: { spinning: dv > 50 } };
  },
};
