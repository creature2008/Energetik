import { describe, it, expect } from 'vitest';
import { runSimulation } from '../src/sim/simulator';
import { Project, Component } from '../src/types';

function emptyProject(): Project {
  return {
    schemaVersion: 1,
    meta: { id: 'p', name: 't', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
    components: [
      { id: '__supply__', deviceId: 'supply', params: {}, pins: {
        L: { id: 'L', voltage: null, current: null },
        N: { id: 'N', voltage: null, current: null }
      } }
    ],
    wires: [],
    nets: [],
    layout: { schematic: {}, realistic: {} },
    settings: { supply: { type: '220' }, units: 'metric' }
  };
}

function addWire(p: Project, id: string, fromC: string, fromP: string, toC: string, toP: string) {
  p.wires.push({
    id, number: p.wires.length + 1,
    from: { compId: fromC, pinId: fromP },
    to: { compId: toC, pinId: toP },
    color: 'black', crossSection: 2.5, waypoints: [], routing: 'auto45'
  });
}

function addComp(p: Project, c: Component) {
  p.components.push(c);
}

describe('Выключатель', () => {
  it('замкнут → лампа горит', () => {
    const p = emptyProject();
    addComp(p, {
      id: 'sw1', deviceId: 'switch', params: { closed: true },
      pins: { '1': { id: '1', voltage: null, current: null }, '2': { id: '2', voltage: null, current: null } }
    });
    addComp(p, {
      id: 'lamp1', deviceId: 'lamp', params: { power: 100, voltage: 220 },
      pins: { L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } }
    });
    addWire(p, 'w1', '__supply__', 'L', 'sw1', '1');
    addWire(p, 'w2', 'sw1', '2', 'lamp1', 'L');
    addWire(p, 'w3', 'lamp1', 'N', '__supply__', 'N');

    const r = runSimulation(p);
    expect(r.pinVoltages.get('lamp1')?.get('L')).toBeCloseTo(220, 0);
  });

  it('разомкнут → напряжение на лампе 0', () => {
    const p = emptyProject();
    addComp(p, {
      id: 'sw1', deviceId: 'switch', params: { closed: false },
      pins: { '1': { id: '1', voltage: null, current: null }, '2': { id: '2', voltage: null, current: null } }
    });
    addComp(p, {
      id: 'lamp1', deviceId: 'lamp', params: { power: 100, voltage: 220 },
      pins: { L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } }
    });
    addWire(p, 'w1', '__supply__', 'L', 'sw1', '1');
    addWire(p, 'w2', 'sw1', '2', 'lamp1', 'L');
    addWire(p, 'w3', 'lamp1', 'N', '__supply__', 'N');

    const r = runSimulation(p);
    // Лампа не получает питание, но net L и N соединены... на самом деле цепь разорвана.
    // Напряжение на лампе относительно земли должно быть 0 или неопределено.
    // Но N лампы = N источника, а L лампы «висит в воздухе» после разомкнутого sw1.
    // Ожидаем, что L лампы = 0 (потому что MNA даст 0 для висячего узла).
    expect(r.pinVoltages.get('lamp1')?.get('L')).toBeCloseTo(0, 0);
  });
});

describe('Автомат', () => {
  it('ток меньше номинала → не срабатывает', () => {
    const p = emptyProject();
    // Автомат 25А
    addComp(p, {
      id: 'br1', deviceId: 'breaker', params: { ratedCurrent: 25, tripped: false },
      pins: { '1': { id: '1', voltage: null, current: null }, '2': { id: '2', voltage: null, current: null } }
    });
    // Лампа 100Вт (0.45А при 220В) — ток мизерный
    addComp(p, {
      id: 'lamp1', deviceId: 'lamp', params: { power: 100, voltage: 220 },
      pins: { L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } }
    });
    addWire(p, 'w1', '__supply__', 'L', 'br1', '1');
    addWire(p, 'w2', 'br1', '2', 'lamp1', 'L');
    addWire(p, 'w3', 'lamp1', 'N', '__supply__', 'N');

    const r = runSimulation(p);
    expect(r.events.length).toBe(0);
  });

  it('ток больше номинала → событие tripped', () => {
    const p = emptyProject();
    // Автомат 1А (маленький, чтобы сработать)
    addComp(p, {
      id: 'br1', deviceId: 'breaker', params: { ratedCurrent: 1, tripped: false },
      pins: { '1': { id: '1', voltage: null, current: null }, '2': { id: '2', voltage: null, current: null } }
    });
    // Лампа 2000Вт — ток ~9А при 220В
    addComp(p, {
      id: 'lamp1', deviceId: 'lamp', params: { power: 2000, voltage: 220 },
      pins: { L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } }
    });
    addWire(p, 'w1', '__supply__', 'L', 'br1', '1');
    addWire(p, 'w2', 'br1', '2', 'lamp1', 'L');
    addWire(p, 'w3', 'lamp1', 'N', '__supply__', 'N');

    const r = runSimulation(p);
    const tripped = r.events.find(e => e.type === 'tripped');
    expect(tripped).toBeDefined();
    expect(tripped?.target?.compId).toBe('br1');
  });
});
