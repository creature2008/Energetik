import { Project, Component } from '../types';
import { buildNetlist } from '../netlist';
import { solveMna, MnaElement } from './mna';

export type SimulationResult = {
  /** netId -> напряжение (В) */
  netVoltages: Map<string, number>;
  /** compId -> { pinId -> напряжение на клемме } */
  pinVoltages: Map<string, Map<string, number>>;
  /** провод id -> ток (А) */
  wireCurrents: Map<string, number>;
  /** События: КЗ, перегруз, срабатывание */
  events: SimEvent[];
};

export type SimEvent = {
  type: 'short-circuit' | 'overload' | 'tripped' | 'burnt';
  message: string;
  target?: { compId?: string; wireId?: string };
};

/**
 * Упрощённая симуляция линейной цепи.
 * Пока поддерживает: источник питания (глобальный), лампу как резистор.
 * Автоматы, реле, двигатели — следующим шагом.
 */
export function runSimulation(project: Project): SimulationResult {
  const nets = buildNetlist(project);

  // Индекс netId -> номер узла (0..n-1). Земля не входит, добавим её отдельно.
  const netIndex = new Map<string, number>();
  nets.forEach((net, i) => netIndex.set(net.id, i));

  // Земля — виртуальный узел с индексом nets.length
  const groundIndex = nets.length;
  const totalNodes = nets.length; // nodeCount (без земли) — solveMna сам добавит землю

  // Построим карту: (compId, pinId) -> netId
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

  // ---- Источник питания (глобальный, по настройкам проекта) ----
  // Пока считаем, что у нас два «глобальных» узла: L и N (фаза и ноль).
  // Они определяются специальным виртуальным компонентом с id = '__supply__'.
  // Клеммы: 'L' — фаза, 'N' — ноль (или PE — позже).
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
      }
    }
    // TODO: switch (выключатель), автомат, розетка, клеммник — далее
  }

  // ---- Решаем ----
  const result = solveMna(totalNodes, elements);

  // ---- Разворачиваем обратно в netVoltages ----
  const netVoltages = new Map<string, number>();
  for (const net of nets) {
    const idx = netIndex.get(net.id)!;
    netVoltages.set(net.id, result.voltages[idx] ?? 0);
  }

  // ---- Напряжения на клеммах ----
  const pinVoltages = new Map<string, Map<string, number>>();
  for (const comp of project.components) {
    const map = new Map<string, number>();
    for (const pinId of Object.keys(comp.pins)) {
      const netId = getNet(comp.id, pinId);
      if (netId) map.set(pinId, netVoltages.get(netId) ?? 0);
    }
    pinVoltages.set(comp.id, map);
  }

  // ---- Токи в проводах ----
  // Пока упрощённо: ток провода = ток через нагрузку, к которой он подключён.
  // В полноценной версии — ток через элемент MNA, соответствующий проводу.
  const wireCurrents = new Map<string, number>();

  const events: SimEvent[] = [];

  return {
    netVoltages,
    pinVoltages,
    wireCurrents,
    events
  };
}
