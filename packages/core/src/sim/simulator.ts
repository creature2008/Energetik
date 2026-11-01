import { Project } from '../types';
import { buildNetlist } from '../netlist';
import { solveIslands, MnaElement } from './mna';
import { registry } from '../registry';
import type { SimEvent, Visual } from '../mod-api';

export type SimulationResult = {
  netVoltages: Map<string, number>;
  pinVoltages: Map<string, Map<string, number>>;
  pinNet: Map<string, string>;
  netIsland: Map<string, number>;
  componentCurrents: Map<string, number>;
  visuals: Map<string, Visual>;
  events: SimEvent[];
};

export function runSimulation(project: Project): SimulationResult {
  const nets = buildNetlist(project);
  const netIndex = new Map<string, number>();
  nets.forEach((net, i) => netIndex.set(net.id, i));

  const pinToNet = new Map<string, string>();
  const netIsland = new Map<string, number>();
  for (const net of nets) {
    for (const pin of net.pins) pinToNet.set(pin.compId + ':' + pin.pinId, net.id);
  }

  function getNet(compId: string, pinId: string): string | null {
    return pinToNet.get(compId + ':' + pinId) ?? null;
  }

  const events: SimEvent[] = [];
  const visuals = new Map<string, Visual>();

  const supplyVoltage = project.settings.supply.type === '380' ? 380 : 220;

  // Итерации: решить -> оценить -> пересчитать
  let result: ReturnType<typeof solveIslands> = { voltages: [], currents: [], islandOf: [] };
  let componentCurrents = new Map<string, number>();

  for (let round = 0; round < 10; round++) {
    const elements: MnaElement[] = [];

    // Источники питания
    for (const s of project.components.filter(c => c.deviceId === 'supply')) {
      const nL = getNet(s.id, 'L'), nN = getNet(s.id, 'N');
      if (!nL || !nN) continue;
      if (nL === nN) {
        events.push({ type: 'short-circuit', message: 'Замкнуты клеммы источника', target: { compId: s.id } });
        continue;
      }
      elements.push({ type: 'voltageSource', nodeA: netIndex.get(nL)!, nodeB: netIndex.get(nN)!, voltage: supplyVoltage, tag: s.id });
    }

    // Остальные компоненты через реестр
    for (const comp of project.components) {
      if (comp.deviceId === 'supply') continue;
      const mod = registry.get(comp.deviceId);
      if (!mod) {
        events.push({ type: 'info', message: 'Неизвестное устройство: ' + comp.deviceId });
        continue;
      }

      const els = mod.stamp({
        comp: { id: comp.id, params: comp.params },
        node: (pinId: string) => {
          const n = getNet(comp.id, pinId);
          return n ? netIndex.get(n)! : null;
        },
        supplyVoltage,
      });
      els.forEach(e => elements.push({ ...e, tag: comp.id }));
    }

    // Считаем
    result = solveIslands(nets.length, elements);

    // Собираем напряжения на клеммах
    const netVoltages = new Map<string, number>();
    for (const net of nets) netVoltages.set(net.id, result.voltages[netIndex.get(net.id)!] ?? 0);

    // Собираем токи
    componentCurrents = new Map<string, number>();
    elements.forEach((el, i) => {
      if (el.tag) {
        const cur = Math.abs(result.currents[i] || 0);
        const existing = componentCurrents.get(el.tag) || 0;
        // Для БП берём максимум, для остальных — сумму (обычно один элемент)
        componentCurrents.set(el.tag, Math.max(existing, cur));
      }
    });

    // Оцениваем каждый компонент
    let changed = false;
    for (const comp of project.components) {
      if (comp.deviceId === 'supply') continue;
      const mod = registry.get(comp.deviceId);
      if (!mod?.evaluate) continue;

      const compPins = pinToNet;
      const pinVoltage = (compId: string, pinId: string): number => {
        const netId = compPins.get(compId + ':' + pinId);
        if (!netId) return 0;
        return netVoltages.get(netId) ?? 0;
      };

      const out = mod.evaluate({
        comp: { id: comp.id, params: comp.params },
        volts: (a: string, b: string) => pinVoltage(comp.id, a) - pinVoltage(comp.id, b),
        current: componentCurrents.get(comp.id) || 0,
        isIsolated: (a: string, b: string) => {
          const na = getNet(comp.id, a), nb = getNet(comp.id, b);
          if (!na || !nb) return true;
          return result.islandOf[netIndex.get(na)!] !== result.islandOf[netIndex.get(nb)!];
        },
      });

      if (out.visual) visuals.set(comp.id, out.visual);
      if (out.events) events.push(...out.events);
      if (out.setParams) {
        for (const [k, v] of Object.entries(out.setParams)) {
          if (comp.params[k] !== v) { comp.params[k] = v; changed = true; }
        }
      }
    }

    if (!changed) break;
  }

  // Финальные напряжения
  const netVoltages = new Map<string, number>();
  const pinVoltages = new Map<string, Map<string, number>>();
  for (const net of nets) {
    netVoltages.set(net.id, result.voltages[netIndex.get(net.id)!] ?? 0);
    netIsland.set(net.id, result.islandOf[netIndex.get(net.id)!] ?? 0);
  }

  for (const comp of project.components) {
    const map = new Map<string, number>();
    for (const [key, netId] of pinToNet) {
      if (key.startsWith(comp.id + ':')) {
        const pinId = key.slice(comp.id.length + 1);
        map.set(pinId, netVoltages.get(netId) ?? 0);
      }
    }
    pinVoltages.set(comp.id, map);
  }

  return { netVoltages, pinVoltages, pinNet: pinToNet, netIsland, componentCurrents, visuals, events };
}

export function measure(res: SimulationResult, a: { compId: string, pinId: string }, b: { compId: string, pinId: string }) {
  const na = res.pinNet.get(a.compId + ':' + a.pinId);
  const nb = res.pinNet.get(b.compId + ':' + b.pinId);
  if (!na || !nb) return { kind: 'open' as const };
  if (res.netIsland.get(na) !== res.netIsland.get(nb)) return { kind: 'isolated' as const };
  return { kind: 'ok' as const, volts: (res.netVoltages.get(na) ?? 0) - (res.netVoltages.get(nb) ?? 0) };
}
