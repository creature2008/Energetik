import { Project } from '../types';
import { buildNetlist } from '../netlist';
import { solveMna, MnaElement } from './mna';

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

  const pinToNet = new Map<string, string>();
  for (const net of nets) {
    for (const pin of net.pins) {
      pinToNet.set(pin.compId + ':' + pin.pinId, net.id);
    }
  }

  function getNet(compId: string, pinId: string): string | null {
    return pinToNet.get(compId + ':' + pinId) ?? null;
  }

  const supplyComp = project.components.find(c => c.deviceId === 'supply');
  const elements: MnaElement[] = [];
  const events: SimEvent[] = [];
  let groundIdx = -1;

  if (supplyComp) {
    const netL = getNet(supplyComp.id, 'L');
    const netN = getNet(supplyComp.id, 'N');
    if (netL && netN) {
      elements.push({ type: 'voltageSource', nodeA: netIndex.get(netL)!, nodeB: netIndex.get(netN)!, voltage: 220 });
      groundIdx = netIndex.get(netN)!;
    } else {
      events.push({ type: 'info', message: 'Источник не подключён' });
    }
  } else {
    events.push({ type: 'info', message: 'В схеме нет источника' });
  }

  if (groundIdx < 0) {
    return { netVoltages: new Map(), pinVoltages: new Map(), wireCurrents: new Map(), events };
  }

  for (const comp of project.components) {
    if (comp.id === supplyComp?.id) continue;
    const netL = getNet(comp.id, 'L');
    const netN = getNet(comp.id, 'N');
    if (!netL || !netN) continue;

    if (comp.deviceId === 'lamp') {
      const power = Number(comp.params.power) || 60;
      const R = (220 * 220) / power;
      elements.push({ type: 'resistor', nodeA: netIndex.get(netL)!, nodeB: netIndex.get(netN)!, resistance: R });
    }
    if (comp.deviceId === 'breaker' && comp.params.tripped !== true) {
      elements.push({ type: 'resistor', nodeA: netIndex.get(netL)!, nodeB: netIndex.get(netN)!, resistance: 0.001 });
    }
    if (comp.deviceId === 'switch' && comp.params.closed === true) {
      elements.push({ type: 'resistor', nodeA: netIndex.get(netL)!, nodeB: netIndex.get(netN)!, resistance: 0.001 });
    }
  }

  const result = solveMna(nets.length, elements, groundIdx);

  const netVoltages = new Map<string, number>();
  for (const net of nets) {
    netVoltages.set(net.id, result.voltages[netIndex.get(net.id)!] ?? 0);
  }

  const pinVoltages = new Map<string, Map<string, number>>();
  for (const comp of project.components) {
    const map = new Map<string, number>();
    for (const pinId of Object.keys(comp.pins)) {
      const netId = getNet(comp.id, pinId);
      if (netId) map.set(pinId, netVoltages.get(netId) ?? 0);
    }
    pinVoltages.set(comp.id, map);
  }

  return { netVoltages, pinVoltages, wireCurrents: new Map(), events };
}
