import type { DeviceMod } from '@electro/core';

export const supply_3ph: DeviceMod = {
  id: 'supply_3ph', name: 'Источник 380В', category: 'power',
  size: { w: 100, h: 80 }, icon: 'supply_3ph.svg',
  isSource: true, neutralPin: 'N',
  pins: [
    { id: 'L1', label: 'L1', side: 'left', color: '#fff' },
    { id: 'L2', label: 'L2', side: 'left', color: '#fff' },
    { id: 'L3', label: 'L3', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [],
  stamp({ node }) {
    const n = node('N');
    if (n === null) return [];
    return ([['L1', 0], ['L2', -120], ['L3', 120]] as const).flatMap(([p, deg]) => {
      const a = node(p);
      return a === null ? [] : [{ type: 'voltageSource' as const, nodeA: a, nodeB: n, rms: 220, phaseDeg: deg, freq: 50 }];
    });
  },
};