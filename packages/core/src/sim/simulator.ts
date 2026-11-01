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
  componentNeutralCurrent: Map<string, number>;
  visuals: Map<string, Visual>;
  events: SimEvent[];
  updatedParams: Map<string, Record<string, any>>;
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
  const updatedParams = new Map<string, Record<string, any>>();

  let lastResult = { vRe: new Float64Array(0), vIm: new Float64Array(0), iRe: new Float64Array(0), iIm: new Float64Array(0), islandOf: new Int32Array(0), islandFreq: [] as number[] };
  let componentCurrents = new Map<string, number>();
  let componentNeutralCurrent = new Map<string, number>();

  for (let iter = 0; iter < 5; iter++) {
    const elements: MnaElement[] = [];

    for (const s of project.components) {
      if (s.deviceId === 'supply') {
        const nL = getNet(s.id, 'L'), nN = getNet(s.id, 'N');
        if (!nL || !nN || nL === nN) continue;
        elements.push({ type: 'voltageSource', nodeA: netIndex.get(nL)!, nodeB: netIndex.get(nN)!, rms: 220, phaseDeg: 0, freq: 50, tag: s.id });
      }
      if (s.deviceId === 'supply_3ph') {
        const nN = getNet(s.id, 'N');
        if (!nN) continue;
        const phases: [string, number][] = [['L1', 0], ['L2', -120], ['L3', 120]];
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

    for (const comp of project.components) {
      if (['supply', 'supply_3ph', 'supply_us_2ph'].includes(comp.deviceId)) continue;
      const mod = registry.get(comp.deviceId);
      if (!mod) continue;
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

    lastResult = solveIslands(nets.length, elements);

    // Суммы токов по тегам
    const tagSums = new Map<string, { re: number; im: number }>();
    componentCurrents = new Map();
    elements.forEach((el, i) => {
      if (el.tag) {
        const re = lastResult.iRe[i] || 0;
        const im = lastResult.iIm[i] || 0;
        const cur = Math.hypot(re, im);
        componentCurrents.set(el.tag, Math.max(componentCurrents.get(el.tag) || 0, cur));
        const s = tagSums.get(el.tag) || { re: 0, im: 0 };
        s.re += re;
        s.im += im;
        tagSums.set(el.tag, s);
      }
    });

    componentNeutralCurrent = new Map();
    tagSums.forEach((s, tag) => componentNeutralCurrent.set(tag, Math.hypot(s.re, s.im)));

    // Оценка модов
    let changed = false;
    for (const comp of project.components) {
      if (['supply', 'supply_3ph', 'supply_us_2ph'].includes(comp.deviceId)) continue;
      const mod = registry.get(comp.deviceId);
      if (!mod?.evaluate) continue;

      const pinVolt = (pinId: string) => {
        const netId = getNet(comp.id, pinId);
        if (!netId) return { re: 0, im: 0 };
        return { re: lastResult.vRe[netIndex.get(netId)!] ?? 0, im: lastResult.vIm[netIndex.get(netId)!] ?? 0 };
      };

      const firstPin = Object.keys(comp.pins)[0];
      const firstNet = getNet(comp.id, firstPin);
      let isAC = false;
      if (firstNet) {
        const idx = netIndex.get(firstNet);
        if (idx !== undefined) {
          const island = lastResult.islandOf[idx];
          isAC = (lastResult.islandFreq[island] || 0) > 0;
        }
      }

      const out = mod.evaluate({
        comp: { id: comp.id, params: comp.params },
        volts: (a: string, b: string) => {
          const va = pinVolt(a), vb = pinVolt(b);
          return Math.hypot(va.re - vb.re, va.im - vb.im);
        },
        signedVolts: (a: string, b: string) => {
          const va = pinVolt(a), vb = pinVolt(b);
          return va.re - vb.re;
        },
        isAC,
        current: componentCurrents.get(comp.id) || 0,
        sumCurrent: componentNeutralCurrent.get(comp.id) || 0,
        isIsolated: (a: string, b: string) => {
          const na = getNet(comp.id, a), nb = getNet(comp.id, b);
          if (!na || !nb) return true;
          return lastResult.islandOf[netIndex.get(na)!] !== lastResult.islandOf[netIndex.get(nb)!];
        },
      });

      if (out.visual) visuals.set(comp.id, out.visual);
      if (out.events) events.push(...out.events);
      if (out.setParams) {
        const existing = updatedParams.get(comp.id) || {};
        for (const [k, v] of Object.entries(out.setParams)) {
          if (comp.params[k] !== v) {
            (comp.params as any)[k] = v;
            existing[k] = v;
            changed = true;
          }
        }
        if (Object.keys(existing).length > 0) updatedParams.set(comp.id, existing);
      }
    }

    if (!changed) break;
  }

  const netVRe = new Map<string, number>();
  const netVIm = new Map<string, number>();
  const netIsland = new Map<string, number>();
  for (const net of nets) {
    const i = netIndex.get(net.id)!;
    netVRe.set(net.id, lastResult.vRe[i] ?? 0);
    netVIm.set(net.id, lastResult.vIm[i] ?? 0);
    netIsland.set(net.id, lastResult.islandOf[i] ?? 0);
  }

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

  return { netVRe, netVIm, pinVRe, pinVIm, pinNet: pinToNet, netIsland, islandFreq: lastResult.islandFreq, componentCurrents, componentNeutralCurrent, visuals, events, updatedParams };
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
