import type { DeviceMod } from '@electro/core';
export const psu_12v: DeviceMod = {
  id: 'psu_12v', name: 'БП 12В', category: 'psu',
  size: { w: 80, h: 60 },
  pins: [
    { id: 'L', label: 'L', side: 'left', color: '#fff' },
    { id: 'N', label: 'N', side: 'left', color: '#3498db' },
    { id: 'V+', label: 'V+', side: 'right', color: '#e74c3c' },
    { id: 'V-', label: 'V-', side: 'right', color: '#111' },
  ],
  params: [
    { key: 'outputVoltage', label: 'Выход (В)', type: 'select', default: 12, options: [
      { value: 5, label: '5 В' }, { value: 12, label: '12 В' }, { value: 24, label: '24 В' }, { value: 48, label: '48 В' }
    ]},
    { key: 'maxOutputAmps', label: 'Макс. ток (А)', type: 'number', default: 8 },
  ],
  stamp({ comp, node }) {
    const nL = node('L'), nN = node('N'), nP = node('V+'), nM = node('V-');
    if (nL == null || nN == null || nP == null || nM == null) return [];
    return [
      { type: 'voltageSource', nodeA: nP, nodeB: nM, voltage: comp.params.outputVoltage, tag: comp.id + ':out' },
      { type: 'resistor', nodeA: nL, nodeB: nN, resistance: 10000, tag: comp.id + ':in' },
    ];
  },
  evaluate({ comp, volts, current }) {
    const vOut = Math.abs(volts('V+', 'V-'));
    const vIn = Math.abs(volts('L', 'N'));
    const isPowered = vIn > 10;
    const isShort = vOut < 1 && current > 1;
    const isOverload = current > (comp.params.maxOutputAmps || 8);
    return {
      visual: {
        label: comp.params.outputVoltage + 'V',
        glow: isPowered ? 1 : 0,
        tint: !isPowered ? '#555' : isShort ? '#e74c3c' : isOverload ? '#f39c12' : '#2ecc71',
      },
      events: isShort ? [{ type: 'short-circuit', message: 'КЗ на выходе БП', target: { compId: comp.id } }] : [],
    };
  },
};
