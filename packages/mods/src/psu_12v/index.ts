import type { DeviceMod } from '@electro/core';
export const psu_12v: DeviceMod = {
  id: 'psu_12v', name: 'БП 12В', category: 'psu',
  size: { w: 80, h: 60 },
  icon: 'psu_12v.svg',
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
  ],
  stamp({ comp, node }) {
    const nL = node('L'), nN = node('N'), nP = node('V+'), nM = node('V-');
    if (nL == null || nN == null || nP == null || nM == null) return [];
    return [
      { type: 'voltageSource', nodeA: nP, nodeB: nM, rms: comp.params.outputVoltage, phaseDeg: 0, freq: 0 },
      { type: 'resistor', nodeA: nL, nodeB: nN, R: 10000 },
    ];
  },
};
