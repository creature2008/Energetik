import { describe, it, expect } from 'vitest';
import { runSimulation } from '../src/sim/simulator';
import { Project, Component } from '../src/types';

function emptyProject(): Project {
  return {
    schemaVersion: 1,
    meta: { id: 'p', name: 't', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
    components: [{ id: '__supply__', deviceId: 'supply', params: {}, pins: {
      L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } } }],
    wires: [], nets: [], layout: { schematic: {}, realistic: {} },
    settings: { supply: { type: '220' }, units: 'metric' }
  };
}

function addWire(p: Project, id: string, fromC: string, fromP: string, toC: string, toP: string, crossSection = 2.5) {
  p.wires.push({ id, number: p.wires.length + 1, from: { compId: fromC, pinId: fromP }, to: { compId: toC, pinId: toP }, color: 'black', crossSection, waypoints: [], routing: 'auto45' });
}

function addComp(p: Project, c: Component) { p.components.push(c); }

describe('Распредкоробка и токи', () => {
  it('один провод от автомата на 3 лампы (сумма токов)', () => {
    const p = emptyProject();
    
    // Автомат 16А
    addComp(p, { id: 'br1', deviceId: 'breaker', params: { ratedCurrent: 16, tripped: false }, pins: {
      '1': { id: '1', voltage: null, current: null }, '2': { id: '2', voltage: null, current: null } } });
    
    // ТОЛЬКО три лампы по 1000 Вт
    addComp(p, { id: 'lamp1', deviceId: 'lamp', params: { power: 1000, voltage: 220 }, pins: {
      L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } } });
    addComp(p, { id: 'lamp2', deviceId: 'lamp', params: { power: 1000, voltage: 220 }, pins: {
      L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } } });
    addComp(p, { id: 'lamp3', deviceId: 'lamp', params: { power: 1000, voltage: 220 }, pins: {
      L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } } });

    // Фаза: supply.L -> br1.1 -> br1.2 -> lamp1.L -> lamp2.L -> lamp3.L
    addWire(p, 'w0', '__supply__', 'L', 'br1', '1', 4.0);
    addWire(p, 'w1', 'br1', '2', 'lamp1', 'L', 2.5);
    addWire(p, 'w2', 'lamp1', 'L', 'lamp2', 'L', 1.5);
    addWire(p, 'w3', 'lamp2', 'L', 'lamp3', 'L', 1.5);
    
    // Ноль: supply.N -> lamp1.N -> lamp2.N -> lamp3.N
    addWire(p, 'w4', '__supply__', 'N', 'lamp1', 'N', 4.0);
    addWire(p, 'w5', 'lamp1', 'N', 'lamp2', 'N', 2.5);
    addWire(p, 'w6', 'lamp2', 'N', 'lamp3', 'N', 1.5);

    const r = runSimulation(p);
    
    // Проверяем токи
    const w1 = r.wireCurrents.get('w1') || 0;
    const w2 = r.wireCurrents.get('w2') || 0;
    const w3 = r.wireCurrents.get('w3') || 0;
    
    // Ожидания:
    // w1 несёт ток всех 3 ламп: 13.6А
    // w2 несёт ток 2 ламп (lamp2, lamp3): 9.1А
    // w3 несёт ток 1 лампы (lamp3): 4.5А
    expect(w1).toBeGreaterThan(w2);
    expect(w2).toBeGreaterThan(w3);
    expect(w3).toBeCloseTo(4.54, 0);

    // Нет событий (2.5 мм² выдержит 13.6А)
    expect(r.events.length).toBe(0);
  });

  it('провод 0.75 мм² с током 23А (5000Вт) сгорает', () => {
    const p = emptyProject();
    addComp(p, { id: 'lamp1', deviceId: 'lamp', params: { power: 5000, voltage: 220 }, pins: {
      L: { id: 'L', voltage: null, current: null }, N: { id: 'N', voltage: null, current: null } } });
    
    addWire(p, 'w1', '__supply__', 'L', 'lamp1', 'L', 0.75);
    addWire(p, 'w2', 'lamp1', 'N', '__supply__', 'N', 0.75);

    const r = runSimulation(p);
    const burnt = r.events.find(e => e.type === 'burnt');
    expect(burnt).toBeDefined();
    expect(burnt?.message).toContain('0.75');
  });
});
