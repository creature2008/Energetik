import type { DeviceMod } from '@electro/core';
export const supply: DeviceMod = {
  id: 'supply', name: 'Источник 220В', category: 'power',
  size: { w: 80, h: 60 }, icon: 'supply.svg',
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [],
  stamp() { return []; },
};
