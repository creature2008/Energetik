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

/**
 * Упрощённая симуляция линейной цепи.
 * Поддерживает: источник питания (глобальный), лампу, выключатель, автомат.
 * Автоматы срабатывают по току (порог = params.ratedCurrent).
 */
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
  // Метаданные об элементах, чтобы потом сопоставить токи с компонентами
  const resistorMeta: { compId: string; kind: 'lamp' | 'wire' | 'switch-on' | 'breaker-on' }[] = [];

  // ---- Источник питания (глобальный) ----
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

  // ---- Компоненты ----
  for (const comp of project.components) {
    if (comp.id === '__supply__') continue;

    if (comp.deviceId === 'lamp') {
      const power = Number(comp.params.power) || 60;
      const voltage = Number(comp.params.voltage) || 220;
      const R = (voltage * voltage) / power;

      const netA = getNet(comp.id, 'L');
      const netB = getNet(comp.id, 'N');
      if (netA && netB) {
        elements.push({
          type: 'resistor',
          nodeA: netIndex.get(netA)!,
          nodeB: netIndex.get(netB)!,
          resistance: R
        });
        resistorMeta.push({ compId: comp.id, kind: 'lamp' });
      }
    }

    if (comp.deviceId === 'switch') {
      // Выключатель: если params.closed === true — проводимость 0.001 (почти 0 Ом, но не 0)
      const closed = comp.params.closed === true;
      if (closed) {
        const netA = getNet(comp.id, '1');
        const netB = getNet(comp.id, '2');
        if (netA && netB) {
          elements.push({
            type: 'resistor',
            nodeA: netIndex.get(netA)!,
            nodeB: netIndex.get(netB)!,
            resistance: 0.001
          });
          resistorMeta.push({ compId: comp.id, kind: 'switch-on' });
        }
      }
      // Если разомкнут — вообще не добавляем в цепь (разрыв).
    }

    if (comp.deviceId === 'breaker') {
      // Автомат: если params.tripped === true — разомкнут. Иначе — как провод (0.001).
      const tripped = comp.params.tripped === true;
      if (!tripped) {
        const netA = getNet(comp.id, '1');
        const netB = getNet(comp.id, '2');
        if (netA && netB) {
          elements.push({
            type: 'resistor',
            nodeA: netIndex.get(netA)!,
            nodeB: netIndex.get(netB)!,
            resistance: 0.001
          });
          resistorMeta.push({ compId: comp.id, kind: 'breaker-on' });
        }
      }
    }
  }

  // ---- Решаем ----
  const result = solveMna(totalNodes, elements);

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

  // ---- Проверка автоматов ----
  // Для каждого автомата: если ток через него превышает ratedCurrent — событие tripped.
  const breakerCurrents = new Map<string, number>();
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const meta = resistorMeta[i];
    if (!meta) continue;
    if (meta.kind === 'breaker-on') {
      const current = Math.abs(result.currents[i] ?? 0);
      breakerCurrents.set(meta.compId, current);
    }
  }

  for (const comp of project.components) {
    if (comp.deviceId === 'breaker') {
      const rated = Number(comp.params.ratedCurrent) || 16;
      const current = breakerCurrents.get(comp.id) ?? 0;
      if (current > rated * 1.2) {
        // Превышение на 20% — считаем «сработал»
        events.push({
          type: 'tripped',
          message: "Автомат " + comp.id + " сработал: ток " + current.toFixed(2) + "А > номинал " + rated + "А",
          target: { compId: comp.id }
        });
      }
    }
  }

  return {
    netVoltages,
    pinVoltages,
    wireCurrents: new Map(),
    events
  };
}

