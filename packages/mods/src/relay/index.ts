import type { DeviceMod } from '@electro/core';

export const relay: DeviceMod = {
  id: 'relay',
  description: 'Промежуточное реле — слабым сигналом на катушке коммутирует несколько пар контактов.',
  usage: 'Подайте напряжение на A1/A2 (катушку) — реле сработает, пары контактов переключатся. НО замыкается при срабатывании, НЗ размыкается. Применение: самоблокировка (ПУСК держит реле), размножение контактов, управление нагрузкой от слабого сигнала (24В → 220В).', name: 'Реле промежуточное', category: 'automation',
  size: { w: 60, h: 80 }, icon: 'relay.svg',
  ledPos: { x: 30, y: 38 },
  hotspot: { x: 22, y: 30, w: 16, h: 16 },
  pins: [
    { id: 'A1', label: 'A1', side: 'top',    color: '#9b59b6' },
    { id: 'P1A', label: '1',  side: 'top',    color: '#888' },
    { id: 'A2', label: 'A2', side: 'bottom', color: '#9b59b6' },
    { id: 'P1B', label: '1',  side: 'bottom', color: '#888' },
    { id: 'P2A', label: '2',  side: 'top',    color: '#888' },
    { id: 'P2B', label: '2',  side: 'bottom', color: '#888' },
  ],
  params: [
    { key: 'coilVoltage', label: 'Катушка (В)', type: 'select', default: 220, options: [
      { value: 12,  label: '12 В DC' },
      { value: 24,  label: '24 В DC' },
      { value: 220, label: '220 В AC' },
      { value: 380, label: '380 В AC' },
    ]},
    { key: 'ratedCurrent', label: 'Номинал (А)', type: 'select', default: 5, options: [
      { value: 5, label: '5 А' }, { value: 10, label: '10 А' }, { value: 16, label: '16 А' },
    ]},
    { key: 'contact1Type', label: 'Пара 1', type: 'select', default: 'NO', options: [
      { value: 'NO', label: 'НО' }, { value: 'NC', label: 'НЗ' },
    ]},
    { key: 'contact2Type', label: 'Пара 2', type: 'select', default: 'NO', options: [
      { value: 'NO', label: 'НО' }, { value: 'NC', label: 'НЗ' },
    ]},
    { key: '_manualOverride', label: 'Ручное ВКЛ', type: 'boolean', default: false },
  ],
  stamp({ comp, node }) {
    const els: any[] = [];
    const a1 = node('A1'), a2 = node('A2');
    if (a1 !== null && a2 !== null) {
      const u = Number(comp.params.coilVoltage) || 220;
      els.push({ type: 'resistor', nodeA: a1, nodeB: a2, R: (u * u) / 5 });
    }
    const engaged = comp.params._engaged === true;
    const pairs: Array<[string, string, string]> = [
      ['P1A', 'P1B', String(comp.params.contact1Type || 'NO')],
      ['P2A', 'P2B', String(comp.params.contact2Type || 'NO')],
    ];
    for (const [ap, bp, type] of pairs) {
      const a = node(ap), b = node(bp);
      if (a === null || b === null) continue;
      const closed = type === 'NC' ? !engaged : engaged;
      if (closed) els.push({ type: 'resistor', nodeA: a, nodeB: b, R: 0.001 });
    }
    return els;
  },
  evaluate({ comp, volts }) {
    const coilV = Math.abs(volts('A1', 'A2'));
    const uRated = Number(comp.params.coilVoltage) || 220;
    const coilEnergized = coilV > uRated * 0.7;
    const ovr = comp.params._manualOverride === true;
    const engaged = ovr || coilEnergized;
    return {
      setParams: { _engaged: engaged },
      visual: {
        ledColor: engaged ? 'green' : 'gray',
        toggleParam: '_manualOverride',
      },
    };
  },
};