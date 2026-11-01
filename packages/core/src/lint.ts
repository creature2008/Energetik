import { Project } from './types';
import { registry } from './registry';
import type { SimEvent } from './mod-api';

export function lintProtection(project: Project): SimEvent[] {
  const events: SimEvent[] = [];
  const seen = new Set<string>();

  const graph = new Map<string, string[]>();
  const addEdge = (a: string, b: string) => {
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a)!.push(b);
    graph.get(b)!.push(a);
  };

  for (const wire of project.wires) {
    addEdge(wire.from.compId + ':' + wire.from.pinId, wire.to.compId + ':' + wire.to.pinId);
  }

  // Внутренние связи только для автоматов и закрытых выключателей.
  for (const comp of project.components) {
    if (comp.deviceId === 'breaker') {
      addEdge(comp.id + ':L', comp.id + ':N');
    }
    if (comp.deviceId === 'switch' && comp.params.closed === true) {
      addEdge(comp.id + ':L', comp.id + ':N');
    }
  }

  const source = project.components.find(c => c.deviceId === 'supply');
  if (!source) return events;

  // BFS от клеммы мотора: находим все автоматы вплоть до источника,
  // но НЕ проходим сквозь них (автомат = граница защиты).
  const findBreakersOnSide = (startNode: string): { breakers: Set<string>; hitsSource: boolean } => {
    const breakers = new Set<string>();
    let hitsSource = false;
    const visited = new Set<string>([startNode]);
    const queue = [startNode];

    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const next of graph.get(node) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        const nextCompId = next.split(':')[0];
        const nextComp = project.components.find(c => c.id === nextCompId);

        if (nextComp?.deviceId === 'supply') {
          hitsSource = true;
          continue;
        }
        if (nextComp?.deviceId === 'breaker') {
          breakers.add(nextCompId);
          continue;  // не идём сквозь автомат
        }
        queue.push(next);
      }
    }
    return { breakers, hitsSource };
  };

  const thresholds: Record<string, number> = { B: 3, C: 5, D: 10 };

  for (const motor of project.components) {
    if (motor.deviceId !== 'motor_1ph' && motor.deviceId !== 'motor_3ph') continue;
    const mod = registry.get(motor.deviceId);
    if (!mod) continue;

    const leftBreakers = findBreakersOnSide(motor.id + ':L');
    const rightBreakers = findBreakersOnSide(motor.id + ':N');

    // Мотор в цепи, если хотя бы одна клемма доходит до источника
    if (!leftBreakers.hitsSource && !rightBreakers.hitsSource) continue;

    const allBreakers = new Set<string>([...leftBreakers.breakers, ...rightBreakers.breakers]);

    const power = Number(motor.params.power) || 1000;
    const multiplier = Number(motor.params.startupMultiplier) || 6;
    const voltage = motor.deviceId === 'motor_3ph' ? 380 : 220;
    const startupCurrent = (power / voltage) * multiplier;

    for (const breakerId of allBreakers) {
      const breaker = project.components.find(c => c.id === breakerId);
      if (!breaker) continue;

      const rated = Number(breaker.params.ratedCurrent) || 16;
      const curve = (breaker.params.curve || 'C') as string;
      const threshold = thresholds[curve] || 5;
      const triggerCurrent = rated * threshold;

      if (startupCurrent > triggerCurrent) {
        const key = breaker.id + '|' + motor.id;
        if (seen.has(key)) continue;
        seen.add(key);

        const motorPowerKw = (power / 1000).toFixed(1);
        events.push({
          type: 'overload',
          message: 'Автомат ' + curve + rated + 'А не подходит для мотора ' + motorPowerKw + 'кВт (пуск ' + startupCurrent.toFixed(0) + 'А > ' + triggerCurrent.toFixed(0) + 'А)',
          target: { compId: motor.id },
        });
      }
    }
  }

  return events;
}
