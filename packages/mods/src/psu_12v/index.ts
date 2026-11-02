import type { DeviceMod } from '@electro/core';

export const psu_12v: DeviceMod = {
  id: 'psu_12v', name: 'БП', category: 'psu',
  size: { w: 100, h: 80 },
  icon: 'psu_12v.svg',
  pins: [
    { id: 'L',  label: 'L',  side: 'left',  color: '#fff' },
    { id: 'N',  label: 'N',  side: 'left',  color: '#3498db' },
    { id: 'V+', label: 'V+', side: 'right', color: '#e74c3c' },
    { id: 'V-', label: 'V-', side: 'right', color: '#111' },
  ],
  params: [
    { key: 'outputVoltage', label: 'Выход (В)', type: 'select', default: 12, options: [
      { value: 5,  label: '5 В' },
      { value: 12, label: '12 В' },
      { value: 24, label: '24 В' },
      { value: 48, label: '48 В' },
    ]},
    { key: 'outputPower', label: 'Выход (Вт)', type: 'number', default: 100 },
    { key: 'inputPower',  label: 'Потребление (Вт)', type: 'number', default: 115 },
    { key: 'grounded', label: 'Заземлён', type: 'boolean', default: true },
    { key: 'leakage', label: 'Утечка (мА)', type: 'number', default: 0 },
  ],
  stamp({ comp, node }) {
    const els: any[] = [];
    const nL = node('L'), nN = node('N');
    const nP = node('V+'), nM = node('V-');
    if (nL != null && nN != null) {
      const inputPower = Math.max(comp.params.inputPower || 0, 0.1);
      els.push({ type: 'resistor', nodeA: nL, nodeB: nN, R: (220 * 220) / inputPower });
    }
    if (comp.params._active !== false && nP != null && nM != null) {
      els.push({ type: 'voltageSource', nodeA: nP, nodeB: nM, rms: comp.params.outputVoltage, phaseDeg: 0, freq: 0 });
    }
    return els;
  },
  evaluate({ comp, volts, current }) {
    const vIn  = Math.abs(volts('L', 'N'));
    const vOut = Math.abs(volts('V+', 'V-'));
    const iOut = current;
    const isPowered = vIn > 10;
    const maxAmps = (comp.params.outputPower || 0) / Math.max(comp.params.outputVoltage || 12, 0.1);
    const isOverload = iOut > maxAmps * 1.05;
    const isShort = isPowered && vOut < 0.5 && iOut > 0.1;
    const shouldBeActive = isPowered && !isShort && !isOverload;
    let ledColor: string;
    if (!isPowered) ledColor = '#333';
    else if (isShort || isOverload) ledColor = '#e74c3c';
    else ledColor = '#2ecc71';
    const outputCurrent = iOut;
    const inputCurrent = vIn > 0 ? (comp.params.inputPower / vIn) : 0;
    const label = vOut > 0.5
      ? comp.params.outputVoltage + 'В ' + outputCurrent.toFixed(1) + 'А'
      : comp.params.outputVoltage + 'В 0А';
    const events: any[] = [];
    if (isShort) {
      events.push({ type: 'short-circuit', message: 'КЗ на выходе БП', target: { compId: comp.id } });
    } else if (isOverload) {
      events.push({ type: 'overload', message: 'Перегруз БП: ' + iOut.toFixed(2) + 'А > ' + maxAmps.toFixed(2) + 'А', target: { compId: comp.id } });
    }
    if (!isPowered) {
      events.push({ type: 'info', message: 'БП без питания на входе', target: { compId: comp.id } });
    }
    return {
      setParams: { _active: shouldBeActive },
      visual: { warning: isShort || isOverload, tint: ledColor, label },
      events,
    };
  },
};
