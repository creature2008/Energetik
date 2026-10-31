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
    elements.push({ type: 'voltageSource', nodeA: netIndex.get(supplyNetL)!, nodeB: netIndex.get(supplyNetN)!, voltage: supplyVoltage });
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
      const netA = getNet(comp.id, 'L');
      const netB = getNet(comp.id, 'N');
      if (netA && netB) {
        elements.push({ type: 'resistor', nodeA: netIndex.get(netA)!, nodeB: netIndex.get(netB)!, resistance: 0.001 });
        resistorMeta.push({ compId: comp.id, kind: 'switch-on' });
      }
    }

    if (comp.deviceId === 'breaker' && comp.params.tripped !== true) {
      const netA = getNet(comp.id, 'L');
      const netB = getNet(comp.id, 'N');
      if (netA && netB) {
        elements.push({ type: 'resistor', nodeA: netIndex.get(netA)!, nodeB: netIndex.get(netB)!, resistance: 0.001 });
        resistorMeta.push({ compId: comp.id, kind: 'breaker-on' });
      }
    }
  }

  const result = solveMna(totalNodes, elements);

  // СДВИГ НЕЙТРАЛИ В НОЛЬ
  let nShift = 0;
  if (supplyNetN) nShift = result.voltages[netIndex.get(supplyNetN)!] ?? 0;

  const netVoltages = new Map<string, number>();
  for (const net of nets) {
    netVoltages.set(net.id, (result.voltages[netIndex.get(net.id)!] ?? 0) - nShift);
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

  const componentCurrents = new Map<string, number>();
  for (let i = 0; i < elements.length; i++) {
    const meta = resistorMeta[i];
    if (meta && meta.kind === 'lamp') {
      componentCurrents.set(meta.compId, Math.abs(result.currents[i] ?? 0));
    }
  }

  const wireCurrents = new Map<string, number>();

  return { netVoltages, pinVoltages, wireCurrents, events };
}
