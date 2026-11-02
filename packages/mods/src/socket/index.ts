import type { DeviceMod } from '@electro/core';

const PRESETS: { value: string; label: string; power: number }[] = [
  { value: 'iron', label: 'Утюг', power: 2000 },
  { value: 'kettle', label: 'Чайник', power: 1500 },
  { value: 'vacuum', label: 'Пылесос', power: 1200 },
  { value: 'microwave', label: 'Микроволновка', power: 800 },
  { value: 'fridge', label: 'Холодильник', power: 300 },
  { value: 'heater', label: 'Обогреватель', power: 1500 },
  { value: 'ac', label: 'Кондиционер', power: 2000 },
  { value: 'hairdryer', label: 'Фен', power: 1800 },
  { value: 'pc', label: 'Компьютер', power: 400 },
  { value: 'tv', label: 'Телевизор', power: 150 },
  { value: 'washer', label: 'Стиралка', power: 2000 },
  { value: 'router', label: 'Роутер', power: 15 },
  { value: 'charger', label: 'Зарядка', power: 20 },
  { value: 'welder', label: 'Сварочник', power: 5000 },
  { value: 'server', label: 'Сервер', power: 800 },
  { value: 'saw', label: 'Пила', power: 1800 },
  { value: 'drill', label: 'Дрель', power: 700 },
  { value: 'compressor', label: 'Компрессор', power: 2200 },
];

function totalPowerOf(comp: any, currentVoltage: number): number {
  const loads = (comp.params.loads as any[]) || [];
  const loadsPower = loads.reduce((s, l) => s + (Number(l.power) || 0), 0);
  const manualW = Number(comp.params.manualPowerW) || 0;
  const manualA = Number(comp.params.manualCurrentA) || 0;
  return loadsPower + manualW + manualA * currentVoltage;
}

function makeSocket(id: string, name: string, ampRating: number, phases: 1 | 3, w: number, h: number, icon: string): DeviceMod {
  const pins: any[] = [];
  if (phases === 1) {
    pins.push({ id: 'L', label: 'L', side: 'left', color: '#fff' });
    pins.push({ id: 'N', label: 'N', side: 'right', color: '#3498db' });
  } else {
    pins.push({ id: 'L1', label: 'L1', side: 'left', color: '#fff' });
    pins.push({ id: 'L2', label: 'L2', side: 'left', color: '#fff' });
    pins.push({ id: 'L3', label: 'L3', side: 'left', color: '#fff' });
    pins.push({ id: 'N', label: 'N', side: 'right', color: '#3498db' });
  }

  return {
    id, name, category: 'sockets',
    size: { w, h },
    icon,
    pins,
    params: [
      { key: 'loads', label: 'Приборы', type: 'loads', default: [], options: PRESETS },
      { key: 'manualPowerW', label: 'Мощность (Вт)', type: 'number', default: 0 },
      { key: 'manualCurrentA', label: 'Ток (А)', type: 'number', default: 0 },
      { key: 'grounded', label: 'Заземлён', type: 'boolean', default: true },
      { key: 'leakage', label: 'Утечка (мА)', type: 'number', default: 0 },
    ],
    stamp({ comp, node }) {
      const n = node('N');
      if (n == null) return [];
      const power = totalPowerOf(comp, 220);
      if (power <= 0) return [];

      if (phases === 1) {
        const l = node('L');
        if (l == null) return [];
        const R = (220 * 220) / power;
        return [{ type: 'resistor', nodeA: l, nodeB: n, R }];
      } else {
        // 3 фазы — по 1/3 нагрузки на каждую
        const perPhasePower = power / 3;
        const R = (220 * 220) / perPhasePower;
        const els: any[] = [];
        for (const ph of ['L1', 'L2', 'L3']) {
          const a = node(ph);
          if (a != null) els.push({ type: 'resistor', nodeA: a, nodeB: n, R });
        }
        return els;
      }
    },
    evaluate({ comp, volts, sumCurrent, isAC }) {
      const phasePin = phases === 1 ? 'L' : 'L1';
      const dv = Math.abs(volts(phasePin, 'N'));
      const vRef = dv > 0 ? dv : 220;
      const power = totalPowerOf(comp, vRef);
      const perPhase = phases === 3 ? power / 3 / vRef : power / vRef;

      let warning = false;
      let reason = '';
      if (perPhase > ampRating) {
        warning = true;
        reason = ' >' + ampRating + 'А';
      }

      let label = '';
      if (power > 0) {
        const pStr = power.toFixed(0) + 'Вт';
        if (phases === 3) {
          label = pStr + ' (' + perPhase.toFixed(1) + 'А/фаза, N:' + sumCurrent.toFixed(2) + 'А)' + reason;
        } else {
          label = pStr + reason;
        }
      }
      return { visual: { warning, label } };
    },
  };
}

export const socket_10a_pe   = makeSocket('socket_10a_pe',   'Розетка 10А (с PE)',   10, 1, 80, 60, 'socket_10a_pe.svg');
export const socket_10a      = makeSocket('socket_10a',      'Розетка 10А (без PE)', 10, 1, 80, 60, 'socket_10a.svg');
export const socket_16a      = makeSocket('socket_16a',      'Розетка 16А (с PE)',   16, 1, 80, 60, 'socket_16a.svg');
export const socket_16a_2p   = makeSocket('socket_16a_2p',   'Розетка 16А (без PE)', 16, 1, 80, 60, 'socket_2p.svg');
export const socket_32a      = makeSocket('socket_32a',      'Розетка 32А (с PE)',   32, 1, 80, 60, 'socket_32a.svg');
export const socket_63a      = makeSocket('socket_63a',      'Розетка 63А (с PE)',   63, 1, 80, 60, 'socket_63a.svg');
export const socket_3ph_16a  = makeSocket('socket_3ph_16a',  'Розетка 3-ф 16А',      16, 3, 110, 60, 'socket_3ph.svg');
export const socket_3ph_32a  = makeSocket('socket_3ph_32a',  'Розетка 3-ф 32А',      32, 3, 110, 60, 'socket_3ph.svg');
