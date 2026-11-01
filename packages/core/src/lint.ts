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

  // Внутренние связи: автоматы (in↔out каждого полюса) и закрытые выключатели
  for (const comp of project.components) {
    if (comp.deviceId.startsWith('breaker')) {
      for (const pinId of Object.keys(comp.pins)) {
        if (pinId.endsWith('_in')) {
          const outId = pinId.replace('_in', '_out');
          if (comp.pins[outId]) addEdge(comp.id + ':' + pinId, comp.id + ':' + outId);
        }
      }
    }
    if (comp.deviceId === 'switch' && comp.params.closed === true) {
      addEdge(comp.id + ':L', comp.id + ':N');
    }
  }

  const sources = project.components.filter(c => c.deviceId === 'supply' || c.deviceId === 'supply_3ph' || c.deviceId === 'supply_us_2ph');
  if (sources.length === 0) return events;

  const sourceNodes = new Set<string>();
  for (const s of sources) {
    const mod = registry.get(s.deviceId);
    if (!mod) continue;
    for (const p of mod.pins) sourceNodes.add(s.id + ':' + p.id);
  }

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

        if (sources.some(s => s.id === nextCompId)) {
          hitsSource = true;
          continue;
        }
        if (nextComp?.deviceId.startsWith('breaker')) {
          breakers.add(nextCompId);
          continue;
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

    const allBreakers = new Set<string>();
    let connected = false;
    for (const pin of mod.pins) {
      const res = findBreakersOnSide(motor.id + ':' + pin.id);
      res.breakers.forEach(b => allBreakers.add(b));
      if (res.hitsSource) connected = true;
    }
    if (!connected) continue;

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
