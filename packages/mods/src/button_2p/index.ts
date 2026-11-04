import type { DeviceMod } from '@electro/core';

const COLOR_MAP: Record<string, string> = {
  red: '#c0392b', green: '#27ae60', yellow: '#f1c40f',
  black: '#2a2a2a', white: '#e8e8e8',
};

export const button_2p: DeviceMod = {
  id: 'button_2p', name: 'Кнопка 1 пара', category: 'automation',
  size: { w: 60, h: 90 }, icon: 'button_2p.svg',
  ledPos: { x: 30, y: 25 },
  buttonFace: { x: 30, y: 50, r: 15 },
  hotspot: { x: 15, y: 35, w: 30, h: 30 },
  pins: [
    { id: 'P1A', label: 'A', side: 'top',    color: '#888' },
    { id: 'P1B', label: 'B', side: 'bottom', color: '#888' },
  ],
  params: [
    { key: 'contactType', label: 'Контакт', type: 'select', default: 'NC', options: [
      { value: 'NC', label: 'НЗ (норм. замкнут)' },
      { value: 'NO', label: 'НО (норм. разомкнут)' },
    ]},
    { key: 'faceColor', label: 'Цвет кнопки', type: 'select', default: 'green', options: [
      { value: 'red', label: 'Красный' }, { value: 'green', label: 'Зелёный' },
      { value: 'yellow', label: 'Жёлтый' }, { value: 'black', label: 'Чёрный' },
      { value: 'white', label: 'Белый' },
    ]},
    { key: '_pressed', label: 'Нажата', type: 'boolean', default: false },
  ],
  stamp({ comp, node }) {
    const a = node('P1A'), b = node('P1B');
    if (a === null || b === null) return [];
    const pressed = comp.params._pressed === true;
    const type = String(comp.params.contactType || 'NC');
    const isClosed = type === 'NC' ? !pressed : pressed;
    if (isClosed) return [{ type: 'resistor', nodeA: a, nodeB: b, R: 0.001 }];
    return [];
  },
  evaluate({ comp }) {
    const pressed = comp.params._pressed === true;
    const color = COLOR_MAP[String(comp.params.faceColor || 'green')] || '#27ae60';
    return {
      visual: {
        ledColor: pressed ? 'green' : 'gray',
        toggleParam: '_pressed',
        buttonFaceColor: color,
      },
    };
  },
};