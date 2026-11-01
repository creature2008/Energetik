import type { DeviceMod } from '@electro/core';

export const supply: DeviceMod = {
  id: 'supply',
  name: 'Источник 220В',
  category: 'power',
  size: { w: 80, h: 60 },
  icon: 'supply.svg',
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [],
  stamp(ctx) {
    const a = ctx.node('L');
    const b = ctx.node('N');
    if (a == null || b == null || a === b) return [];
    return [{ type: 'voltageSource', nodeA: a, nodeB: b, voltage: ctx.supplyVoltage }];
  },
};
