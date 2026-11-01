import type { DeviceMod } from '@electro/core';
export const breaker: DeviceMod = {
  id: 'breaker', name: 'Автомат', category: 'protection',
  size: { w: 80, h: 60 }, icon: 'breaker.svg',
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'right', color: '#3498db' },
  ],
  params: [
    { key: 'ratedCurrent', label: 'Номинал (А)', type: 'select', default: 16, options: [
      { value: 6, label: '6 А' }, { value: 10, label: '10 А' }, { value: 16, label: '16 А' }, { value: 25, label: '25 А' }, { value: 32, label: '32 А' }
    ]},
    { key: 'curve', label: 'Кривая', type: 'select', default: 'C', options: [
      { value: 'B', label: 'B (3-5×)' }, { value: 'C', label: 'C (5-10×)' }, { value: 'D', label: 'D (10-20×)' }
    ]},
    { key: 'tripped', label: 'Отключён', type: 'boolean', default: false },
  ],
  stamp({ comp, node }) {
    const a = node('L'), b = node('N');
    if (a == null || b == null) return [];
    return [{ type: 'resistor', nodeA: a, nodeB: b, resistance: comp.params.tripped ? 1e9 : 0.001 }];
  },
  evaluate({ comp, current }) {
    if (!comp.params.tripped && current > comp.params.ratedCurrent * 1.15) {
      return {
        setParams: { tripped: true },
        events: [{ type: 'tripped', message: 'Автомат ' + comp.id + ' выбило (ток ' + current.toFixed(2) + 'А > ' + (comp.params.ratedCurrent * 1.15).toFixed(1) + 'А)', target: { compId: comp.id } }],
      };
    }
    return {};
  },
};
