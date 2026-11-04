import type { DeviceMod } from '@electro/core';

export const supply_us_2ph: DeviceMod = {
  id: 'supply_us_2ph', name: 'Источник 120/240В (US)', category: 'power',
  size: { w: 100, h: 80 }, icon: 'supply_us.svg',
  isSource: true, neutralPin: 'N',
  pins: [
    { id: 'L1', label: 'L1', side: 'left', color: '#fff' },
    { id: 'L2', label: 'L2', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [],
  stamp({ node }) {
    const n = node('N');
    if (n === null) return [];
    return ([['L1', 0], ['L2', 180]] as const).flatMap(([p, deg]) => {
      const a = node(p);
      return a === null ? [] : [{ type: 'voltageSource' as const, nodeA: a, nodeB: n, rms: 120, phaseDeg: deg, freq: 60 }];
    });
  },
};