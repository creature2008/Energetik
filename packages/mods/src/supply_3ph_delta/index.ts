import type { DeviceMod } from '@electro/core';

export const supply_3ph_delta: DeviceMod = {
  id: 'supply_3ph_delta', name: 'Источник 380В (Δ)', category: 'power',
  size: { w: 100, h: 80 }, icon: 'supply_3ph_delta.svg',
  isSource: true,
  pins: [
    { id: 'L1', label: 'L1', side: 'left', color: '#fff' },
    { id: 'L2', label: 'L2', side: 'left', color: '#fff' },
    { id: 'L3', label: 'L3', side: 'left', color: '#fff' },
  ],
  params: [],
  stamp({ node }) {
    const a = node('L1'), b = node('L2'), c = node('L3');
    if (a === null || b === null || c === null) return [];
    return [
      { type: 'voltageSource', nodeA: a, nodeB: b, rms: 380, phaseDeg: 0, freq: 50 },
      { type: 'voltageSource', nodeA: b, nodeB: c, rms: 380, phaseDeg: -120, freq: 50 },
    ];
  },
};