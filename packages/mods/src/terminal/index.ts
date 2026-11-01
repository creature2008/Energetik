import type { DeviceMod } from '@electro/core';
export const terminal: DeviceMod = {
  id: 'terminal', name: 'Клеммник', category: 'boxes',
  size: { w: 80, h: 60 },
  pins: [
    { id: '1', label: '1', side: 'left', color: '#7f8c8d' },
    { id: '2', label: '2', side: 'left', color: '#7f8c8d' },
    { id: '3', label: '3', side: 'right', color: '#7f8c8d' },
    { id: '4', label: '4', side: 'right', color: '#7f8c8d' },
  ],
  params: [{ key: 'lanes', label: 'Линий', type: 'number', default: 4 }],
  stamp({ node }) {
    const els = [];
    const n1 = node('1'), n2 = node('2'), n3 = node('3'), n4 = node('4');
    if (n1 != null && n2 != null) els.push({ type: 'resistor', nodeA: n1, nodeB: n2, R: 0.001 });
    if (n3 != null && n4 != null) els.push({ type: 'resistor', nodeA: n3, nodeB: n4, R: 0.001 });
    return els;
  },
};
