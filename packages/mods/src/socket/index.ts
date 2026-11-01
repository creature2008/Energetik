import type { DeviceMod } from '@electro/core';
export const socket: DeviceMod = {
  id: 'socket', name: 'Розетка', category: 'sockets',
  size: { w: 80, h: 60 },
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [{ key: 'voltage', label: 'Напряжение (В)', type: 'number', default: 220 }],
  stamp({ node }) {
    const a = node('L'), b = node('N');
    if (a == null || b == null) return [];
    return [{ type: 'resistor', nodeA: a, nodeB: b, resistance: 1000 }];
  },
};
