import { describe, it, expect, beforeAll } from 'vitest';
import { runSimulation } from '../src/sim/simulator';
import { registry } from '../src/registry';
import type { Project } from '../src/types';

const supplyMod: any = {
  id: 'supply', name: 'supply', category: 'power', size: { w: 1, h: 1 }, pins: [], params: [],
  isSource: true, neutralPin: 'N',
  stamp: ({ node }: any) => {
    const a = node('L'), b = node('N');
    return a === null || b === null ? [] : [{ type: 'voltageSource', nodeA: a, nodeB: b, rms: 220, phaseDeg: 0, freq: 50 }];
  },
};
const supply3Mod: any = {
  id: 'supply_3ph', name: 'supply_3ph', category: 'power', size: { w: 1, h: 1 }, pins: [], params: [],
  isSource: true, neutralPin: 'N',
  stamp: ({ node }: any) => {
    const n = node('N');
    if (n === null) return [];
    return [['L1', 0], ['L2', -120], ['L3', 120]].flatMap(([p, deg]: any) => {
      const a = node(p);
      return a === null ? [] : [{ type: 'voltageSource', nodeA: a, nodeB: n, rms: 220, phaseDeg: deg, freq: 50 }];
    });
  },
};
const lampMod: any = {
  id: 'lamp', name: 'lamp', category: 'light', size: { w: 1, h: 1 }, pins: [], params: [],
  stamp: ({ comp, node }: any) => {
    const a = node('L'), b = node('N');
    if (a === null || b === null) return [];
    return [{ type: 'resistor', nodeA: a, nodeB: b, R: comp.params.voltage ** 2 / comp.params.power }];
  },
};

beforeAll(() => {
  registry.register(supplyMod);
  registry.register(supply3Mod);
  registry.register(lampMod);
});

const pins = (...ids: string[]) => Object.fromEntries(ids.map(i => [i, { id: i }]));
const pin = (compId: string, pinId: string) => ({ compId, pinId });

function makeProject(components: any[], wires: any[]): Project {
  return {
    schemaVersion: 1,
    meta: { id: 'p', name: 't', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
    components, wires, nets: [],
    layout: { schematic: {}, realistic: {} },
    settings: { supply: { type: '220' }, units: 'metric' },
  } as any;
}

const supply = { id: 'sup', deviceId: 'supply', params: {}, pins: pins('L', 'N') };
const lamp = (id: string) => ({ id, deviceId: 'lamp', params: { power: 100, voltage: 220 }, pins: pins('L', 'N') });
const wire = (id: string, from: any, to: any) => ({ id, number: 1, from, to, color: '', crossSection: 2.5, waypoints: [], routing: 'manual' });

const dv = (r: any, comp: string, a: string, b: string) => {
  const re = (p: string) => r.pinVRe.get(comp)?.get(p) ?? 0;
  const im = (p: string) => r.pinVIm.get(comp)?.get(p) ?? 0;
  return Math.hypot(re(a) - re(b), im(a) - im(b));
};

describe('Физика MNA', () => {
  it('1. Последовательные две лампы: на каждой по 110 В', () => {
    const p = makeProject([supply, lamp('l1'), lamp('l2')], [
      wire('w1', pin('sup', 'L'), pin('l1', 'L')),
      wire('w2', pin('l1', 'N'), pin('l2', 'L')),
      wire('w3', pin('l2', 'N'), pin('sup', 'N')),
    ]);
    const r = runSimulation(p);
    expect(dv(r, 'l1', 'L', 'N')).toBeCloseTo(110, 0);
    expect(dv(r, 'l2', 'L', 'N')).toBeCloseTo(110, 0);
  });

  it('2. Параллельные две лампы: на каждой по 220 В', () => {
    const p = makeProject([supply, lamp('l1'), lamp('l2')], [
      wire('w1', pin('sup', 'L'), pin('l1', 'L')),
      wire('w2', pin('sup', 'L'), pin('l2', 'L')),
      wire('w3', pin('sup', 'N'), pin('l1', 'N')),
      wire('w4', pin('sup', 'N'), pin('l2', 'N')),
    ]);
    const r = runSimulation(p);
    expect(dv(r, 'l1', 'L', 'N')).toBeCloseTo(220, 0);
    expect(dv(r, 'l2', 'L', 'N')).toBeCloseTo(220, 0);
  });

  it('3. КЗ на выводах источника: событие short-circuit, без краша', () => {
    const p = makeProject([supply], [wire('w1', pin('sup', 'L'), pin('sup', 'N'))]);
    const r = runSimulation(p);
    expect(r.events.some(e => e.type === 'short-circuit' && e.target?.compId === 'sup')).toBe(true);
  });

  it('4. Три фазы: |L1-L2| = 381 В, ток нейтрали ~0 при равных нагрузках', () => {
    const sup3 = { id: 's', deviceId: 'supply_3ph', params: {}, pins: pins('L1', 'L2', 'L3', 'N') };
    const ls = ['a', 'b', 'c'].map(lamp);
    const ph = ['L1', 'L2', 'L3'];
    const wires = ls.flatMap((l, i) => [
      wire('w' + i, pin('s', ph[i]), pin(l.id, 'L')),
      wire('n' + i, pin(l.id, 'N'), pin('s', 'N')),
    ]);
    const r = runSimulation(makeProject([sup3, ...ls], wires));
    expect(dv(r, 's', 'L1', 'L2')).toBeCloseTo(381, 0);
    expect(r.pinCurrents.get('s:N') ?? 0).toBeLessThan(0.01);
  });
});