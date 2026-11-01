import type { DeviceMod } from '@electro/core';
export const supply_us_2ph: DeviceMod = {
  id: 'supply_us_2ph', name: 'Источник 120/240В (US)', category: 'power',
  size: { w: 100, h: 80 }, icon: 'supply_us.svg',
  pins: [
    { id: 'L1', label: 'L1', side: 'left', color: '#fff' },
    { id: 'L2', label: 'L2', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [],
  stamp() { return []; },
};
