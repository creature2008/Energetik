import type { DeviceMod } from '@electro/core';

const ON_COLOR: Record<string, string> = {
  red: '#e74c3c', green: '#2ecc71', yellow: '#f1c40f',
  blue: '#3498db', white: '#ecf0f1',
};
const OFF_COLOR: Record<string, string> = {
  red: '#4a1a1a', green: '#1a4a2a', yellow: '#4a3a10',
  blue: '#1a2e4a', white: '#4a4a4a',
};

export const signal_lamp: DeviceMod = {
  id: 'signal_lamp',
  description: 'Сигнальная лампа — индикатор наличия напряжения на клеммах L-N.',
  usage: 'Подайте напряжение на L и N — стекло загорится выбранным цветом. Без напряжения — тусклый оттенок (лампа выключена). По ПУЭ цвет: красный — авария/СТОП, зелёный — работа/норма, жёлтый — предупреждение.', name: 'Сигнальная лампа', category: 'automation',
  size: { w: 40, h: 50 }, icon: 'signal_lamp.svg',
  buttonFace: { x: 20, y: 22, r: 11 },
  pins: [
    { id: 'L', label: 'L', side: 'top',    color: '#fff' },
    { id: 'N', label: 'N', side: 'bottom', color: '#3498db' },
  ],
  params: [
    { key: 'color', label: 'Цвет', type: 'select', default: 'red', options: [
      { value: 'red',    label: 'Красный' },
      { value: 'green',  label: 'Зелёный' },
      { value: 'yellow', label: 'Жёлтый' },
      { value: 'blue',   label: 'Синий' },
      { value: 'white',  label: 'Белый' },
    ]},
    { key: 'voltage', label: 'Напряжение (В)', type: 'number', default: 220 },
    { key: 'power', label: 'Мощность (Вт)', type: 'number', default: 3 },
  ],
  stamp({ comp, node }) {
    const a = node('L'), b = node('N');
    if (a === null || b === null) return [];
    const power = Math.max(Number(comp.params.power) || 3, 0.5);
    const voltage = Number(comp.params.voltage) || 220;
    return [{ type: 'resistor', nodeA: a, nodeB: b, R: (voltage * voltage) / power }];
  },
  evaluate({ comp, volts }) {
    const v = Math.abs(volts('L', 'N'));
    const vNom = Number(comp.params.voltage) || 220;
    const isOn = v > vNom * 0.5;
    const color = String(comp.params.color || 'red');
    return {
      visual: {
        buttonFaceColor: isOn ? (ON_COLOR[color] || '#e74c3c') : (OFF_COLOR[color] || '#4a1a1a'),
        glow: isOn ? 0.5 : 0,
      },
    };
  },
};