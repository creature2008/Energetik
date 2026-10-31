import { Project } from '../types';
import { buildNetlist } from '../netlist';
import { solveMna, MnaElement } from './mna';
import { getMaxCurrent, CableMaterial } from '../data/cables';

export type SimulationResult = {
  netVoltages: Map<string, number>;
  pinVoltages: Map<string, Map<string, number>>;
  wireCurrents: Map<string, number>;
  events: SimEvent[];
};

export type SimEvent = {
  type: 'short-circuit' | 'overload' | 'tripped' | 'burnt' | 'info';
  message: string;
  target?: { compId?: string; wireId?: string };
};

export function runSimulation(project: Project): SimulationResult {
  const nets = buildNetlist(project);
  const netIndex = new Map<string, number>();
  nets.forEach((net, i) => netIndex.set(net.id, i));

  const totalNodes = nets.length;
  const pinToNet = new Map<string, string>();
  for (const net of nets) {
    for (const pin of net.pins) {
      pinToNet.set(pin.compId + ':' + pin.pinId, net.id);
    }
  }

  function getNet(compId: string, pinId: string): string | null {
    return pinToNet.get(compId + ':' + pinId) ?? null;
  }

  const elements: MnaElement[] = [];
  const events: SimEvent[] = [];
  const resistorMeta: { compId: string; kind: 'lamp' | 'switch-on' | 'breaker-on' }[] = [];

  const supplyNetL = getNet('__supply__', 'L');
  const supplyNetN = getNet('__supply__', 'N');

  if (supplyNetL && supplyNetN) {
    const supplyVoltage = project.settings.supply.type === '380' ? 380 : 
                          project.settings.supply.type === '220' ? 220 :
                          project.settings.supply.type === '12' ? 12 : 5;
    elements.push({
      type: 'voltageSource',
      nodeA: netIndex.get(supplyNetL)!,
      nodeB: netIndex.get(supplyNetN)!,
      voltage: supplyVoltage
    });
  }

  for (const comp of project.components) {
    if (comp.id === '__supply__') continue;

    if (comp.deviceId === 'lamp') {
      const power = Number(comp.params.power) || 60;
      const voltage = Number(comp.params.voltage) || 220;
      const R = (voltage * voltage) / power;
      const netA = getNet(comp.id, 'L');
      const netB = getNet(comp.id, 'N');
      if (netA && netB) {
        elements.push({ type: 'resistor', nodeA: netIndex.get(netA)!, nodeB: netIndex.get(netB)!, resistance: R });
        resistorMeta.push({ compId: comp.id, kind: 'lamp' });
      }
    }

    if (comp.deviceId === 'switch' && comp.params.closed === true) {
      const netA = getNet(comp.id, '1');
      const netB = getNet(comp.id, '2');
      if (netA && netB) {
        elements.push({ type: 'resistor', nodeA: netIndex.get(netA)!, nodeB: netIndex.get(netB)!, resistance: 0.001 });
        resistorMeta.push({ compId: comp.id, kind: 'switch-on' });
      }
    }

    if (comp.deviceId === 'breaker' && comp.params.tripped !== true) {
      const netA = getNet(comp.id, '1');
      const netB = getNet(comp.id, '2');
      if (netA && netB) {
        elements.push({ type: 'resistor', nodeA: netIndex.get(netA)!, nodeB: netIndex.get(netB)!, resistance: 0.001 });
        resistorMeta.push({ compId: comp.id, kind: 'breaker-on' });
      }
    }
  }

  const result = solveMna(totalNodes, elements);

  const netVoltages = new Map<string, number>();
  for (const net of nets) netVoltages.set(net.id, result.voltages[netIndex.get(net.id)!] ?? 0);

  const pinVoltages = new Map<string, Map<string, number>>();
  for (const comp of project.components) {
    const map = new Map<string, number>();
    for (const pinId of Object.keys(comp.pins)) {
      const netId = getNet(comp.id, pinId);
      if (netId) map.set(pinId, netVoltages.get(netId) ?? 0);
    }
    pinVoltages.set(comp.id, map);
  }

  const componentCurrents = new Map<string, number>();
  for (let i = 0; i < elements.length; i++) {
    const meta = resistorMeta[i];
    if (meta && meta.kind === 'lamp') {
      componentCurrents.set(meta.compId, Math.abs(result.currents[i] ?? 0));
    }
  }

  type Edge = { wireId?: string; toNode: string };
  const graph = new Map<string, Edge[]>();

  function addEdge(from: string, to: string, wireId?: string) {
    if (!graph.has(from)) graph.set(from, []);
    if (!graph.has(to)) graph.set(to, []);
    graph.get(from)!.push({ wireId, toNode: to });
    graph.get(to)!.push({ wireId, toNode: from });
  }

  for (const w of project.wires) {
    const a = w.from.compId + ':' + w.from.pinId;
    const b = w.to.compId + ':' + w.to.pinId;
    if (a === b) continue;
    addEdge(a, b, w.id);
  }

  for (const comp of project.components) {
    if (comp.deviceId === 'switch' && comp.params.closed === true) {
      addEdge(comp.id + ':1', comp.id + ':2');
    }
    if (comp.deviceId === 'breaker' && comp.params.tripped !== true) {
      addEdge(comp.id + ':1', comp.id + ':2');
    }
  }

  function findPath(start: string, end: string): string[] | null {
    if (start === end) return [];
    const visited = new Set<string>([start]);
    const queue: { node: string; path: string[] }[] = [{ node: start, path: [] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      for (const edge of graph.get(node) || []) {
        if (visited.has(edge.toNode)) continue;
        const newPath = edge.wireId ? [...path, edge.wireId] : path;
        if (edge.toNode === end) return newPath;
        visited.add(edge.toNode);
        queue.push({ node: edge.toNode, path: newPath });
      }
    }
    return null;
  }

  const wireCurrents = new Map<string, number>();
  function addWireCurrent(wireId: string, current: number) {
    wireCurrents.set(wireId, (wireCurrents.get(wireId) || 0) + current);
  }

  for (const comp of project.components) {
    if (comp.deviceId !== 'lamp') continue;
    const current = componentCurrents.get(comp.id);
    if (!current || current < 1e-9) continue;

    const pathL = findPath(comp.id + ':L', '__supply__:L');
    if (pathL) for (const wid of pathL) addWireCurrent(wid, current);

    const pathN = findPath(comp.id + ':N', '__supply__:N');
    if (pathN) for (const wid of pathN) addWireCurrent(wid, current);
  }

  for (const w of project.wires) {
    const current = wireCurrents.get(w.id) || 0;
    const material: CableMaterial = (w as any).material === 'aluminum' ? 'aluminum' : 'copper';
    const maxCurrent = getMaxCurrent(w.crossSection, material);
    if (maxCurrent > 0 && current > maxCurrent) {
      events.push({
        type: 'burnt',
        message: 'Провод №' + w.number + ' (' + w.crossSection + ' мм²) сгорит! Ток ' + current.toFixed(2) + 'А, предел ' + maxCurrent + 'А',
        target: { wireId: w.id }
      });
    }
  }

  const breakerCurrents = new Map<string, number>();
  for (let i = 0; i < elements.length; i++) {
    const meta = resistorMeta[i];
    if (meta && meta.kind === 'breaker-on') {
      breakerCurrents.set(meta.compId, Math.abs(result.currents[i] ?? 0));
    }
  }

  for (const comp of project.components) {
    if (comp.deviceId === 'breaker') {
      const rated = Number(comp.params.ratedCurrent) || 16;
      const current = breakerCurrents.get(comp.id) ?? 0;
      
      if (current > rated) {
        const isShortCircuit = current > 1000;
        events.push({
          type: isShortCircuit ? 'short-circuit' : 'tripped',
          message: 'Автомат ' + comp.id + ' сработал: ток ' + current.toFixed(2) + 'А ' + 
                   (isShortCircuit ? '(КЗ!)' : '> номинал ' + rated + 'А'),
          target: { compId: comp.id }
        });
      }
    }
  }

  return { netVoltages, pinVoltages, wireCurrents, events };
}
