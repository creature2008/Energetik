import type { DeviceMod } from '@electro/core';
export const led_strip: DeviceMod = {
  id: 'led_strip', name: 'СД Лента', category: 'light',
  size: { w: 100, h: 60 }, icon: 'led_strip.svg',
  pins: [
    { id: 'V+', label: 'V+', side: 'left', color: '#e74c3c' },
    { id: 'V-', label: 'V-', side: 'right', color: '#111' },
  ],
  params: [
    { key: 'powerPerMeter', label: 'Мощность (Вт/м)', type: 'number', default: 14.4 },
    { key: 'length', label: 'Длина (м)', type: 'number', default: 5 },
    { key: 'nominalVoltage', label: 'Напряжение (В)', type: 'number', default: 12 },
    { key: 'grounded', label: 'Заземлён', type: 'boolean', default: true },
    { key: 'leakage', label: 'Утечка (мА)', type: 'number', default: 0 },
  ],
  stamp({ comp, node }) {
    const a = node('V+'), b = node('V-');
    if (a == null || b == null) return [];
    const totalPower = comp.params.powerPerMeter * comp.params.length;
    const safePower = Math.max(totalPower, 0.1);
    const R = Math.pow(comp.params.nominalVoltage, 2) / safePower;
    return [{ type: 'resistor', nodeA: a, nodeB: b, R }];
  },
  evaluate({ comp, volts, signedVolts, isAC }) {
    const dv = Math.abs(volts('V+', 'V-'));
    const vNom = comp.params.nominalVoltage || 12;
    const ratio = Math.min(Math.pow(dv / vNom, 2), 1);
    const totalPower = comp.params.powerPerMeter * comp.params.length;
    const label = totalPower.toFixed(1) + 'Вт';

    let warning = false;
    let reason = '';

    if (isAC) {
      warning = true;
      reason = ' (AC!)';
    } else if (signedVolts('V+', 'V-') < -0.1) {
      warning = true;
      reason = ' (полярность!)';
    } else if (dv > vNom * 1.1) {
      warning = true;
      reason = ' (>' + (vNom * 1.1).toFixed(0) + 'В)';
    }

    const events: any[] = [];
    if (warning) {
      events.push({ type: 'overload', message: 'СД-лента: ' + (reason || 'перенапряжение'), target: { compId: comp.id } });
    }
    return { visual: { glow: ratio * 0.5, warning, label: label + reason }, events };
  },
};
