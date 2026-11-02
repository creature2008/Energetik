import type { DeviceMod } from '@electro/core';

function makeSwitch(id: string, name: string, keys: number, w: number, icon: string): DeviceMod {
  const pins: any[] = [];
  for (let k = 1; k <= keys; k++) {
    pins.push({ id: 'in' + k, label: 'in' + k, side: 'top', color: '#fff' });
  }
  pins.push({ id: 'out', label: 'out', side: 'bottom', color: '#fff' });

  const params: any[] = [];
  for (let k = 1; k <= keys; k++) {
    params.push({ key: 'closed' + k, label: 'Клавиша ' + k, type: 'boolean', default: false });
  }

  return {
    id, name, category: 'switches',
    size: { w, h: 70 },
    icon,
    pins,
    params,
    stamp({ comp, node }) {
      const els: any[] = [];
      const out = node('out');
      if (out == null) return [];
      for (let k = 1; k <= keys; k++) {
        if (!comp.params['closed' + k]) continue;
        const inp = node('in' + k);
        if (inp != null) els.push({ type: 'resistor', nodeA: inp, nodeB: out, R: 0.001 });
      }
      return els;
    },
    evaluate({ comp, current }) {
      const isWarning = current > 10;
      const events: any[] = [];
      if (isWarning) {
        events.push({
          type: 'overload',
          message: 'Выключатель перегружен: ' + current.toFixed(1) + 'А > 10А',
          target: { compId: comp.id },
        });
      }
      // Показываем текущий ток прямо на выключателе для отладки
      const label = current > 0.01 ? current.toFixed(2) + 'А' : '';
      return { visual: { warning: isWarning, label }, events };
    },
  };
}

export const switch_1 = makeSwitch('switch_1', 'Выключатель 1кл', 1, 50, 'switch_1.svg');
export const switch_2 = makeSwitch('switch_2', 'Выключатель 2кл', 2, 80, 'switch_2.svg');
export const switch_3 = makeSwitch('switch_3', 'Выключатель 3кл', 3, 110, 'switch_3.svg');
