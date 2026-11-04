import type { DeviceMod } from '@electro/core';

export const supply: DeviceMod = {
  id: 'supply', name: 'Источник 220В', category: 'power',
  size: { w: 80, h: 60 }, icon: 'supply.svg',
  isSource: true, neutralPin: 'N',
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [],
  stamp({ node }) {
    const a = node('L'), b = node('N');
    if (a === null || b === null) return [];
    return [{ type: 'voltageSource', nodeA: a, nodeB: b, rms: 220, phaseDeg: 0, freq: 50 }];
  },
};