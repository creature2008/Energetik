import type { DeviceMod } from '@electro/core';

function makeBreaker(id: string, name: string, poles: number, w: number): DeviceMod {
  const phases = poles === 1 ? ['L'] : poles === 2 ? ['L', 'N'] : poles === 3 ? ['L1', 'L2', 'L3'] : ['L1', 'L2', 'L3', 'N'];

  const pins: any[] = [];
  // Все входы сверху
  for (const p of phases) pins.push({ id: p + '_in', label: p, side: 'top', color: p === 'N' ? '#3498db' : '#fff' });
  // Все выходы снизу
  for (const p of phases) pins.push({ id: p + '_out', label: p, side: 'bottom', color: p === 'N' ? '#3498db' : '#fff' });

  return {
    id, name, category: 'protection',
    size: { w, h: 90 },
    pins,
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
      if (comp.params.tripped) return [];
      const els: any[] = [];
      for (const p of phases) {
        const a = node(p + '_in'), b = node(p + '_out');
        if (a != null && b != null) els.push({ type: 'resistor', nodeA: a, nodeB: b, R: 0.001 });
      }
      return els;
    },
    evaluate({ comp, current }) {
      if (!comp.params.tripped && current > comp.params.ratedCurrent * 1.15) {
        return { setParams: { tripped: true }, events: [{ type: 'tripped', message: 'Автомат ' + comp.id + ' выбило (ток ' + current.toFixed(2) + 'А)', target: { compId: comp.id } }] };
      }
      return {};
    },
  };
}

export const breaker_1p = makeBreaker('breaker_1p', 'Автомат 1P', 1, 50);
export const breaker_2p = makeBreaker('breaker_2p', 'Автомат 2P', 2, 80);
export const breaker_3p = makeBreaker('breaker_3p', 'Автомат 3P', 3, 110);
export const breaker_4p = makeBreaker('breaker_4p', 'Автомат 4P', 4, 140);
