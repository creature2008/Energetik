import type { DeviceMod } from '@electro/core';

// Глобальные таймеры: compId -> timeoutId
const timers = new Map<string, any>();

export const timer_relay: DeviceMod = {
  id: 'timer_relay',
  name: 'Реле времени',
  description: 'Реле времени — переключает контакт через заданную задержку после подачи питания на катушку.',
  usage: 'Подайте питание на A1/A2 — через N секунд контакт COM-OUT переключится. Режим ON: срабатывает через N сек после включения. Режим OFF: отключается через N сек после снятия питания. Внимание: физическая задержка моделируется через setTimeout — если перезапустить приложение, таймер сбросится.',
  category: 'automation',
  size: { w: 60, h: 100 }, icon: 'timer_relay.svg',
  ledPos: { x: 30, y: 46 },
  hotspot: { x: 15, y: 83, w: 30, h: 12 },
  pins: [
    { id: 'A1',  label: 'A1', side: 'top',    color: '#9b59b6' },
    { id: 'COM', label: 'C',  side: 'top',    color: '#888' },
    { id: 'A2',  label: 'A2', side: 'bottom', color: '#9b59b6' },
    { id: 'OUT', label: 'O',  side: 'bottom', color: '#888' },
  ],
  params: [
    { key: 'coilVoltage', label: 'Катушка (В)', type: 'select', default: 220, options: [
      { value: 12,  label: '12 В DC' },
      { value: 24,  label: '24 В DC' },
      { value: 220, label: '220 В AC' },
    ]},
    { key: 'mode', label: 'Режим', type: 'select', default: 'ON', options: [
      { value: 'ON',  label: 'Задержка на ВКЛ' },
      { value: 'OFF', label: 'Задержка на ВЫКЛ' },
    ]},
    { key: 'delay', label: 'Задержка (сек)', type: 'number', default: 5 },
    { key: 'contactType', label: 'Контакт', type: 'select', default: 'NO', options: [
      { value: 'NO', label: 'НО' }, { value: 'NC', label: 'НЗ' },
    ]},
    { key: '_manualOverride', label: 'Ручное ВКЛ', type: 'boolean', default: false },
    { key: '_triggered', label: 'Сработало', type: 'boolean', default: false },
  ],
  stamp({ comp, node }) {
    const els: any[] = [];
    const a1 = node('A1'), a2 = node('A2');
    if (a1 !== null && a2 !== null) {
      const u = Number(comp.params.coilVoltage) || 220;
      els.push({ type: 'resistor', nodeA: a1, nodeB: a2, R: (u * u) / 3 });
    }
    const engaged = comp.params._triggered === true;
    const type = String(comp.params.contactType || 'NO');
    const closed = type === 'NC' ? !engaged : engaged;
    if (closed) {
      const c = node('COM'), o = node('OUT');
      if (c !== null && o !== null) els.push({ type: 'resistor', nodeA: c, nodeB: o, R: 0.001 });
    }
    return els;
  },
  evaluate({ comp, volts }) {
    const coilV = Math.abs(volts('A1', 'A2'));
    const uRated = Number(comp.params.coilVoltage) || 220;
    const coilEnergized = coilV > uRated * 0.7;
    const ovr = comp.params._manualOverride === true;
    const delaySec = Math.max(Number(comp.params.delay) || 5, 0.1);
    const triggered = comp.params._triggered === true;

    // Ручной override — сработало сразу
    if (ovr) {
      if (timers.has(comp.id)) { clearTimeout(timers.get(comp.id)); timers.delete(comp.id); }
      return {
        setParams: { _triggered: true },
        visual: { ledColor: 'green', toggleParam: '_manualOverride' },
      };
    }

    // Нет напряжения на катушке — сброс таймера
    if (!coilEnergized) {
      if (timers.has(comp.id)) { clearTimeout(timers.get(comp.id)); timers.delete(comp.id); }
      if (triggered) {
        return {
          setParams: { _triggered: false },
          visual: { ledColor: 'gray', toggleParam: '_manualOverride' },
        };
      }
      return { visual: { ledColor: 'gray', toggleParam: '_manualOverride' } };
    }

    // Уже сработало — держим
    if (triggered) {
      return { visual: { ledColor: 'green', toggleParam: '_manualOverride' } };
    }

    // Напряжение есть, ещё не сработало, таймера нет — запускаем
    if (!timers.has(comp.id) && typeof window !== 'undefined') {
      const compId = comp.id;
      const delayMs = delaySec * 1000;
      const t = setTimeout(() => {
        timers.delete(compId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('electro:timer-fire', { detail: { compId } }));
        }
      }, delayMs);
      timers.set(comp.id, t);
    }

    return { visual: { ledColor: 'yellow', toggleParam: '_manualOverride' } };
  },
};