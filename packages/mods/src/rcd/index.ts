import type { DeviceMod } from '@electro/core';

function makeRCD(id: string, name: string, poles: 2 | 4, hasOverload: boolean, w: number, icon: string): DeviceMod {
  const phases = poles === 2 ? ['L'] : ['L1', 'L2', 'L3'];
  const pins: any[] = [];
  for (const p of phases) {
    pins.push({ id: p + '_in',  label: p, side: 'top',    color: '#fff' });
    pins.push({ id: p + '_out', label: p, side: 'bottom', color: '#fff' });
  }
  pins.push({ id: 'N_in',  label: 'N', side: 'top',    color: '#3498db' });
  pins.push({ id: 'N_out', label: 'N', side: 'bottom', color: '#3498db' });

  const params: any[] = [];
  if (hasOverload) {
    params.push(
      { key: 'ratedCurrent', label: 'Номинал (А)', type: 'select', default: 16, options: [
        { value: 6, label: '6 А' }, { value: 10, label: '10 А' }, { value: 16, label: '16 А' },
        { value: 25, label: '25 А' }, { value: 32, label: '32 А' }, { value: 40, label: '40 А' },
        { value: 63, label: '63 А' },
      ]},
      { key: 'curve', label: 'Кривая', type: 'select', default: 'C', options: [
        { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' },
      ]},
    );
  }
  params.push(
    { key: 'leakageThreshold', label: 'Уставка утечки (мА)', type: 'select', default: 30, options: [
      { value: 10,  label: '10 мА' },
      { value: 30,  label: '30 мА' },
      { value: 100, label: '100 мА' },
      { value: 300, label: '300 мА' },
    ]},
    { key: 'tripped', label: 'Сработало', type: 'boolean', default: false },
  );

  return {
    id, name,
    category: 'protection',
    size: { w, h: 80 },
    icon,
    pins,
    params,
    stamp({ comp, node }) {
      if (comp.params.tripped) return [];
      const els: any[] = [];
      for (const p of phases) {
        const a = node(p + '_in'), b = node(p + '_out');
        if (a != null && b != null) els.push({ type: 'resistor', nodeA: a, nodeB: b, R: 0.001 });
      }
      const nIn = node('N_in'), nOut = node('N_out');
      if (nIn != null && nOut != null) els.push({ type: 'resistor', nodeA: nIn, nodeB: nOut, R: 0.001 });
      return els;
    },
    evaluate({ comp, pinCurrentComplex, pinCurrent }) {
      if (comp.params.tripped) {
        return { visual: { tint: '#e74c3c', label: hasOverload ? 'ДИФ' : 'УЗО' } };
      }

      // Векторная сумма токов на выходных клеммах — это дифференциальный ток
      let re = 0, im = 0;
      for (const p of phases) {
        const c = pinCurrentComplex(p + '_out');
        re += c.re;
        im += c.im;
      }
      const cN = pinCurrentComplex('N_out');
      re += cN.re;
      im += cN.im;

      const leakMA = Math.hypot(re, im) * 1000;

      const threshold = Number(comp.params.leakageThreshold) || 30;

      if (leakMA > threshold) {
        return {
          setParams: { tripped: true },
          events: [{
            type: 'tripped',
            message: (hasOverload ? 'Дифавтомат' : 'УЗО') + ' сработало: утечка ' + leakMA.toFixed(0) + 'мА > ' + threshold + 'мА',
            target: { compId: comp.id },
          }],
          visual: { tint: '#e74c3c', label: hasOverload ? 'ДИФ' : 'УЗО' },
        };
      }

      if (hasOverload) {
        const rated = Number(comp.params.ratedCurrent) || 16;
        let maxCurrent = 0;
        for (const p of phases) maxCurrent = Math.max(maxCurrent, pinCurrent(p + '_out'));
        maxCurrent = Math.max(maxCurrent, pinCurrent('N_out'));
        if (maxCurrent > rated * 1.15) {
          return {
            setParams: { tripped: true },
            events: [{
              type: 'tripped',
              message: 'Дифавтомат сработал: ток ' + maxCurrent.toFixed(2) + 'А > ' + rated + 'А',
              target: { compId: comp.id },
            }],
            visual: { tint: '#e74c3c', label: 'ДИФ' },
          };
        }
      }

      return { visual: { tint: '#3498db', label: hasOverload ? 'ДИФ' : 'УЗО' } };
    },
  };
}

export const rcd_2p = makeRCD('rcd_2p', 'УЗО 2P', 2, false, 100, 'rcd_2p.svg');
export const rcd_4p = makeRCD('rcd_4p', 'УЗО 4P', 4, false, 140, 'rcd_4p.svg');
export const dif_2p = makeRCD('dif_2p', 'Дифавтомат 2P', 2, true, 100, 'dif_2p.svg');
export const dif_4p = makeRCD('dif_4p', 'Дифавтомат 4P', 4, true, 140, 'dif_4p.svg');
