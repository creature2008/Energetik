import { Project } from '../types';
import { buildNetlist } from '../netlist';
import { solveIslands, MnaElement } from './mna';
import { registry } from '../registry';
import type { SimEvent, Visual } from '../mod-api';

export type SimulationResult = {
  netVRe: Map<string, number>;
  netVIm: Map<string, number>;
  pinVRe: Map<string, Map<string, number>>;
  pinVIm: Map<string, Map<string, number>>;
  pinNet: Map<string, string>;
  netIsland: Map<string, number>;
  islandFreq: number[];
  componentCurrents: Map<string, number>;
  visuals: Map<string, Visual>;
  events: SimEvent[];
};

export function runSimulation(project: Project): SimulationResult {
  const nets = buildNetlist(project);
  const netIndex = new Map<string, number>();
  nets.forEach((net, i) => netIndex.set(net.id, i));

  const pinToNet = new Map<string, string>();
  for (const net of nets) {
    for (const pin of net.pins) pinToNet.set(pin.compId + ':' + pin.pinId, net.id);
  }

  function getNet(compId: string, pinId: string): string | null {
    return pinToNet.get(compId + ':' + pinId) ?? null;
  }

  const events: SimEvent[] = [];
  const visuals = new Map<string, Visual>();

  // Основной источник определяет «базовую» частоту для supply (по умолчанию 50 Гц)
  const elements: MnaElement[] = [];

  // Источники
  for (const s of project.components) {
    if (s.deviceId === 'supply') {
      const nL = getNet(s.id, 'L'), nN = getNet(s.id, 'N');
      if (!nL || !nN) continue;
      if (nL === nN) { events.push({ type: 'short-circuit', message: 'Замкнуты клеммы источника', target: { compId: s.id } }); continue; }
      elements.push({ type: 'voltageSource', nodeA: netIndex.get(nL)!, nodeB: netIndex.get(nN)!, rms: 220, phaseDeg: 0, freq: 50, tag: s.id });
    }
    if (s.deviceId === 'supply_3ph') {
      const nN = getNet(s.id, 'N');
      if (!nN) continue;
      const phases = [['L1', 0], ['L2', -120], ['L3', 120]] as const;
      for (const [ph, deg] of phases) {
        const nPh = getNet(s.id, ph);
        if (nPh && nPh !== nN) {
          elements.push({ type: 'voltageSource', nodeA: netIndex.get(nPh)!, nodeB: netIndex.get(nN)!, rms: 220, phaseDeg: deg, freq: 50, tag: s.id + ':' + ph });
        }
      }
    }
    if (s.deviceId === 'supply_us_2ph') {
      const nN = getNet(s.id, 'N');
      const nL1 = getNet(s.id, 'L1');
      const nL2 = getNet(s.id, 'L2');
      if (nL1 && nN && nL1 !== nN) elements.push({ type: 'voltageSource', nodeA: netIndex.get(nL1)!, nodeB: netIndex.get(nN)!, rms: 120, phaseDeg: 0, freq: 60, tag: s.id + ':L1' });
      if (nL2 && nN && nL2 !== nN) elements.push({ type: 'voltageSource', nodeA: netIndex.get(nL2)!, nodeB: netIndex.get(nN)!, rms: 120, phaseDeg: 180, freq: 60, tag: s.id + ':L2' });
    }
  }

  // Компоненты через моды
  for (const comp of project.components) {
    if (['supply', 'supply_3ph', 'supply_us_2ph'].includes(comp.deviceId)) continue;
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
      supplyVoltage: 220,
    });
    els.forEach(e => elements.push({ ...e, tag: comp.id } as MnaElement));
  }

  const result = solveIslands(nets.length, elements);

  // Собираем напряжения
  const netVRe = new Map<string, number>();
  const netVIm = new Map<string, number>();
  const netIsland = new Map<string, number>();
  for (const net of nets) {
    const i = netIndex.get(net.id)!;
    netVRe.set(net.id, result.vRe[i] ?? 0);
    netVIm.set(net.id, result.vIm[i] ?? 0);
    netIsland.set(net.id, result.islandOf[i] ?? 0);
  }

  // Напряжения на клеммах
  const pinVRe = new Map<string, Map<string, number>>();
  const pinVIm = new Map<string, Map<string, number>>();
  for (const comp of project.components) {
    const mRe = new Map<string, number>();
    const mIm = new Map<string, number>();
    for (const pinId of Object.keys(comp.pins)) {
      const netId = getNet(comp.id, pinId);
      if (netId) {
        mRe.set(pinId, netVRe.get(netId) ?? 0);
        mIm.set(pinId, netVIm.get(netId) ?? 0);
      }
    }
    pinVRe.set(comp.id, mRe);
    pinVIm.set(comp.id, mIm);
  }

  // Токи
  const componentCurrents = new Map<string, number>();
  elements.forEach((el, i) => {
    if (el.tag) {
      const cur = Math.hypot(result.iRe[i] || 0, result.iIm[i] || 0);
      const existing = componentCurrents.get(el.tag) || 0;
      componentCurrents.set(el.tag, Math.max(existing, cur));
    }
  });

  // Оценка модов
  for (const comp of project.components) {
    if (['supply', 'supply_3ph', 'supply_us_2ph'].includes(comp.deviceId)) continue;
    const mod = registry.get(comp.deviceId);
    if (!mod?.evaluate) continue;

    const pinVolt = (pinId: string): { re: number; im: number } => {
      const netId = getNet(comp.id, pinId);
      if (!netId) return { re: 0, im: 0 };
      return { re: netVRe.get(netId) ?? 0, im: netVIm.get(netId) ?? 0 };
    };

    const out = mod.evaluate({
      comp: { id: comp.id, params: comp.params },
      volts: (a: string, b: string) => {
        const va = pinVolt(a), vb = pinVolt(b);
        return Math.hypot(va.re - vb.re, va.im - vb.im);
      },
      current: componentCurrents.get(comp.id) || 0,
      isIsolated: (a: string, b: string) => {
        const na = getNet(comp.id, a), nb = getNet(comp.id, b);
        if (!na || !nb) return true;
        return result.islandOf[netIndex.get(na)!] !== result.islandOf[netIndex.get(nb)!];
      },
    });

    if (out.visual) visuals.set(comp.id, out.visual);
    if (out.events) events.push(...out.events);
  }

  return { netVRe, netVIm, pinVRe, pinVIm, pinNet: pinToNet, netIsland, islandFreq: result.islandFreq, componentCurrents, visuals, events };
}

export function measure(
  res: SimulationResult,
  a: { compId: string; pinId: string },
  b: { compId: string; pinId: string },
): { kind: 'ok'; volts: number; isAC: boolean; freq: number } | { kind: 'isolated' } | { kind: 'open' } {
  const na = res.pinNet.get(a.compId + ':' + a.pinId);
  const nb = res.pinNet.get(b.compId + ':' + b.pinId);
  if (!na || !nb) return { kind: 'open' };
  const ia = res.netIsland.get(na);
  const ib = res.netIsland.get(nb);
  if (ia !== ib) return { kind: 'isolated' };
  const freq = res.islandFreq[ia ?? 0] || 0;
  const dvRe = (res.netVRe.get(na) ?? 0) - (res.netVRe.get(nb) ?? 0);
  const dvIm = (res.netVIm.get(na) ?? 0) - (res.netVIm.get(nb) ?? 0);
  const isAC = freq > 0;
  const volts = isAC ? Math.hypot(dvRe, dvIm) : dvRe;
  return { kind: 'ok', volts, isAC, freq };
}
