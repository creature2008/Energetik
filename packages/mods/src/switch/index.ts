import type { DeviceMod } from '@electro/core';
export const switchMod: DeviceMod = {
  id: 'switch', name: 'Выключатель', category: 'switches',
  size: { w: 80, h: 60 }, icon: 'switch.svg',
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [
    { key: 'closed', label: 'Замкнут', type: 'boolean', default: false },
  ],
  stamp({ comp, node }) {
    if (!comp.params.closed) return [];
    const a = node('L'), b = node('N');
    if (a == null || b == null) return [];
    return [{ type: 'resistor', nodeA: a, nodeB: b, resistance: 0.001 }];
  },
};
