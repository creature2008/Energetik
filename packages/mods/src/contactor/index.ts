import type { DeviceMod } from '@electro/core';

export const contactor: DeviceMod = {
  id: 'contactor', name: 'Контактор', category: 'automation',
  size: { w: 90, h: 140 }, icon: 'contactor.svg',
  ledPos: { x: 45, y: 90 },
  hotspot: { x: 30, y: 52, w: 30, h: 18 },
  pins: [
    { id: 'L1', label: '1L1', side: 'top',    color: '#fff' },
    { id: 'L2', label: '3L2', side: 'top',    color: '#fff' },
    { id: 'L3', label: '5L3', side: 'top',    color: '#fff' },
    { id: 'A1', label: 'A1',  side: 'top',    color: '#9b59b6' },
    { id: 'T1', label: '2T1', side: 'bottom', color: '#fff' },
    { id: 'T2', label: '4T2', side: 'bottom', color: '#fff' },
    { id: 'T3', label: '6T3', side: 'bottom', color: '#fff' },
    { id: 'A2', label: 'A2',  side: 'bottom', color: '#9b59b6' },
  ],
  params: [
    { key: 'coilVoltage', label: 'Катушка (В)', type: 'select', default: 220, options: [
      { value: 12,  label: '12 В DC' },
      { value: 24,  label: '24 В DC' },
      { value: 220, label: '220 В AC' },
      { value: 380, label: '380 В AC' },
    ]},
    { key: 'ratedCurrent', label: 'Номинал (А)', type: 'select', default: 25, options: [
      { value: 9, label: '9 А' }, { value: 12, label: '12 А' }, { value: 18, label: '18 А' },
      { value: 25, label: '25 А' }, { value: 32, label: '32 А' }, { value: 40, label: '40 А' },
      { value: 63, label: '63 А' },
    ]},
    { key: 'contactType', label: 'Контакт', type: 'select', default: 'NO', options: [
      { value: 'NO', label: 'НО (норм. разомкнут)' },
      { value: 'NC', label: 'НЗ (норм. замкнут)' },
    ]},
    { key: '_manualOverride', label: 'Ручной режим', type: 'select', default: 0, options: [
      { value: 0, label: 'Авто (катушка)' },
      { value: 1, label: 'Принуд. ВКЛ' },
      { value: 2, label: 'Принуд. ВЫКЛ' },
    ]},
  ],
  stamp({ comp, node }) {
    const els: any[] = [];
    const a1 = node('A1'), a2 = node('A2');
    if (a1 !== null && a2 !== null) {
      const u = Number(comp.params.coilVoltage) || 220;
      els.push({ type: 'resistor', nodeA: a1, nodeB: a2, R: (u * u) / 10 });
    }
    const engaged = comp.params._engaged === true;
    const isNC = comp.params.contactType === 'NC';
    const closed = isNC ? !engaged : engaged;
    if (closed) {
      for (const [ip, op] of [['L1','T1'], ['L2','T2'], ['L3','T3']] as const) {
        const a = node(ip), b = node(op);
        if (a !== null && b !== null) els.push({ type: 'resistor', nodeA: a, nodeB: b, R: 0.001 });
      }
    }
    return els;
  },
  evaluate({ comp, volts, current }) {
    const coilV = Math.abs(volts('A1', 'A2'));
    const uRated = Number(comp.params.coilVoltage) || 220;
    const coilEnergized = coilV > uRated * 0.7;
    const ovr = Number(comp.params._manualOverride) || 0;
    let engaged: boolean;
    if (ovr === 1) engaged = true;
    else if (ovr === 2) engaged = false;
    else engaged = coilEnergized;
    const closed = comp.params.contactType === 'NC' ? !engaged : engaged;
    const rated = Number(comp.params.ratedCurrent) || 25;
    const isOverloaded = closed && current > rated;
    const ledColor: 'green' | 'red' | 'gray' =
      isOverloaded ? 'red' : (closed ? 'green' : 'gray');
    return {
      setParams: { _engaged: engaged },
      visual: { warning: isOverloaded, ledColor, toggleParam: '_manualOverride' },
    };
  },
};