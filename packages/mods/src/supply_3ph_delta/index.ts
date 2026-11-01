import type { DeviceMod } from '@electro/core';
export const supply_3ph_delta: DeviceMod = {
  id: 'supply_3ph_delta', name: 'Источник 380В (Δ)', category: 'power',
  size: { w: 100, h: 80 }, icon: 'supply_3ph_delta.svg',
  pins: [
    { id: 'L1', label: 'L1', side: 'left', color: '#fff' },
    { id: 'L2', label: 'L2', side: 'left', color: '#fff' },
    { id: 'L3', label: 'L3', side: 'left', color: '#fff' },
  ],
  params: [],
  stamp() { return []; },
};
