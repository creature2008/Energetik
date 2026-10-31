import { describe, it, expect } from 'vitest';
import { buildNetlist } from '../src/netlist';
import { Project } from '../src/types';

describe('buildNetlist', () => {
  it('объединяет две клеммы одним проводом', () => {
    const project: Project = {
      schemaVersion: 1,
      meta: { id: 'p1', name: 'test', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
      components: [],
      wires: [
        { id: 'w1', number: 1, from: { compId: 'c1', pinId: 'L' }, to: { compId: 'c2', pinId: 'N' }, color: '', crossSection: 1.5, waypoints: [], routing: 'auto45' }
      ],
      nets: [],
      layout: { schematic: {}, realistic: {} },
      settings: { supply: { type: '220' }, units: 'metric' }
    };

    const nets = buildNetlist(project);
    expect(nets.length).toBe(1);
    expect(nets[0].pins.length).toBe(2);
  });

  it('объединяет транзитивно три клеммы', () => {
    const project: Project = {
      schemaVersion: 1,
      meta: { id: 'p1', name: 'test', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
      components: [],
      wires: [
        { id: 'w1', number: 1, from: { compId: 'c1', pinId: 'L' }, to: { compId: 'c2', pinId: 'N' }, color: '', crossSection: 1.5, waypoints: [], routing: 'auto45' },
        { id: 'w2', number: 2, from: { compId: 'c2', pinId: 'N' }, to: { compId: 'c3', pinId: 'PE' }, color: '', crossSection: 1.5, waypoints: [], routing: 'auto45' }
      ],
      nets: [],
      layout: { schematic: {}, realistic: {} },
      settings: { supply: { type: '220' }, units: 'metric' }
    };

    const nets = buildNetlist(project);
    expect(nets.length).toBe(1);
    expect(nets[0].pins.length).toBe(3);
  });
});
