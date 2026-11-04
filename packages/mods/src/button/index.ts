import type { DeviceMod } from '@electro/core';

const COLOR_MAP: Record<string, string> = {
  red: '#c0392b', green: '#27ae60', yellow: '#f1c40f',
  black: '#2a2a2a', white: '#e8e8e8',
};

export const button: DeviceMod = {
  id: 'button', name: 'Кнопка 2 пары', category: 'automation',
  size: { w: 70, h: 100 }, icon: 'button.svg',
  ledPos: { x: 35, y: 32 },
  buttonFace: { x: 35, y: 55, r: 15 },
  hotspot: { x: 20, y: 40, w: 30, h: 30 },
  pins: [
    { id: 'P1A', label: '1', side: 'top',    color: '#888' },
    { id: 'P1B', label: '1', side: 'top',    color: '#888' },
    { id: 'P2A', label: '2', side: 'bottom', color: '#888' },
    { id: 'P2B', label: '2', side: 'bottom', color: '#888' },
  ],
  params: [
    { key: 'contact1Type', label: 'Пара 1', type: 'select', default: 'NC', options: [
      { value: 'NC', label: 'НЗ (норм. замкнут)' },
      { value: 'NO', label: 'НО (норм. разомкнут)' },
    ]},
    { key: 'contact2Type', label: 'Пара 2', type: 'select', default: 'NO', options: [
      { value: 'NC', label: 'НЗ (норм. замкнут)' },
      { value: 'NO', label: 'НО (норм. разомкнут)' },
    ]},
    { key: 'faceColor', label: 'Цвет кнопки', type: 'select', default: 'red', options: [
      { value: 'red', label: 'Красный' }, { value: 'green', label: 'Зелёный' },
      { value: 'yellow', label: 'Жёлтый' }, { value: 'black', label: 'Чёрный' },
      { value: 'white', label: 'Белый' },
    ]},
    { key: '_pressed', label: 'Нажата', type: 'boolean', default: false },
  ],
  stamp({ comp, node }) {
    const els: any[] = [];
    const pressed = comp.params._pressed === true;
    const pairs: Array<[string, string, string]> = [
      ['P1A', 'P1B', String(comp.params.contact1Type || 'NC')],
      ['P2A', 'P2B', String(comp.params.contact2Type || 'NO')],
    ];
    for (const [aPin, bPin, type] of pairs) {
      const a = node(aPin), b = node(bPin);
      if (a === null || b === null) continue;
      const isClosed = type === 'NC' ? !pressed : pressed;
      if (isClosed) els.push({ type: 'resistor', nodeA: a, nodeB: b, R: 0.001 });
    }
    return els;
  },
  evaluate({ comp }) {
    const pressed = comp.params._pressed === true;
    const color = COLOR_MAP[String(comp.params.faceColor || 'red')] || '#c0392b';
    return {
      visual: {
        ledColor: pressed ? 'green' : 'gray',
        toggleParam: '_pressed',
        buttonFaceColor: color,
      },
    };
  },
};