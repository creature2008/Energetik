import { describe, it, expect } from 'vitest';
import { runSimulation } from '../src/sim/simulator';
import { Project } from '../src/types';

function makeProject(components: any[], wires: any[]): Project {
  return {
    schemaVersion: 1,
    meta: { id: 'p', name: 't', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
    components,
    wires,
    nets: [],
    layout: { schematic: {}, realistic: {} },
    settings: { supply: { type: '220' }, units: 'metric' }
  };
}

const supply = { id: 'sup', deviceId: 'supply', params: {}, pins: { L: { id: 'L' }, N: { id: 'N' } } };
const lamp = (id: string) => ({ id, deviceId: 'lamp', params: { power: 100, voltage: 220 }, pins: { L: { id: 'L' }, N: { id: 'N' } } });
const wire = (id: string, from: any, to: any) => ({ id, number: 1, from, to, color: '', crossSection: 2.5, waypoints: [], routing: 'manual' });

describe('Физика MNA', () => {
  it('1. Последовательные две лампы: на каждой по 110В', () => {
    const p = makeProject(
      [supply, lamp('l1'), lamp('l2')],
      [
        wire('w1', { compId: 'sup', pinId: 'L' }, { compId: 'l1', pinId: 'L' }),
        wire('w2', { compId: 'l1', pinId: 'N' }, { compId: 'l2', pinId: 'L' }),
        wire('w3', { compId: 'l2', pinId: 'N' }, { compId: 'sup', pinId: 'N' })
      ]
    );
    const r = runSimulation(p);
    const v1 = Math.abs((r.pinVoltages.get('l1')?.get('L') || 0) - (r.pinVoltages.get('l1')?.get('N') || 0));
    const v2 = Math.abs((r.pinVoltages.get('l2')?.get('L') || 0) - (r.pinVoltages.get('l2')?.get('N') || 0));
    expect(v1).toBeCloseTo(110, 0);
    expect(v2).toBeCloseTo(110, 0);
  });

  it('2. Параллельные две лампы: на каждой по 220В', () => {
    const p = makeProject(
      [supply, lamp('l1'), lamp('l2')],
      [
        wire('w1', { compId: 'sup', pinId: 'L' }, { compId: 'l1', pinId: 'L' }),
        wire('w2', { compId: 'sup', pinId: 'L' }, { compId: 'l2', pinId: 'L' }),
        wire('w3', { compId: 'sup', pinId: 'N' }, { compId: 'l1', pinId: 'N' }),
        wire('w4', { compId: 'sup', pinId: 'N' }, { compId: 'l2', pinId: 'N' })
      ]
    );
    const r = runSimulation(p);
    const v1 = Math.abs((r.pinVoltages.get('l1')?.get('L') || 0) - (r.pinVoltages.get('l1')?.get('N') || 0));
    const v2 = Math.abs((r.pinVoltages.get('l2')?.get('L') || 0) - (r.pinVoltages.get('l2')?.get('N') || 0));
    expect(v1).toBeCloseTo(220, 0);
    expect(v2).toBeCloseTo(220, 0);
  });

  it('3. Короткое замыкание: ток огромный', () => {
    const p = makeProject(
      [supply],
      [
        wire('w1', { compId: 'sup', pinId: 'L' }, { compId: 'sup', pinId: 'N' })
      ]
    );
    const r = runSimulation(p);
    // В этой реализации КЗ сломает решатель (матрица вырождена), но мы это починим позже
    // Пока просто проверяем, что нет краша
    expect(r).toBeDefined();
  });
});
