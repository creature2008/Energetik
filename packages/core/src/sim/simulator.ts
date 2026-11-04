import { Project } from '../types';
import { buildNetlist } from '../netlist';
import { solveIslands, MnaElement, type MnaResult } from './mna';
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
  pinCurrents: Map<string, number>;
  pinPower: Map<string, number>;
  wireLosses: Map<string, { current: number; dv: number; pLoss: number; R: number; material: string; crossSection: number; length: number }>;
  componentNeutralCurrent: Map<string, number>;
  visuals: Map<string, Visual>;
  events: SimEvent[];
  updatedParams: Map<string, Record<string, any>>;
  debugLogs: string[];
};

export function runSimulation(project: Project): SimulationResult {
  project = structuredClone(project);
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
  const debugLogs: string[] = [];

  let lastResult: MnaResult = { vRe: new Float64Array(0), vIm: new Float64Array(0), iRe: new Float64Array(0), iIm: new Float64Array(0), islandOf: new Int32Array(0), islandFreq: [] as number[] };
  let componentCurrents = new Map<string, number>();
  let componentNeutralCurrent = new Map<string, number>();
  let pinCurrentsLocal = new Map<string, number>();

  // Сброс состояния БП перед расчётом
  for (const comp of project.components) {
    if (comp.deviceId === 'psu_12v') {
      (comp.params as any)._active = undefined;
    }
  }

  for (let iter = 0; iter < 8; iter++) {
    const elements: MnaElement[] = [];

    // === Источники ===
    let peNetIndex = -1;

    // источники первыми, чтобы PE был известен до расчёта утечек
    const ordered = [...project.components].sort((x, y) =>
      Number(!!registry.get(y.deviceId)?.isSource) - Number(!!registry.get(x.deviceId)?.isSource));

    for (const comp of ordered) {
      const mod = registry.get(comp.deviceId);
      if (!mod) { if (iter === 0) debugLogs.push('Нет мода: ' + comp.deviceId); continue; }

      const nodeOf = (pinId: string): number | null => {
        const n = getNet(comp.id, pinId);
        return n ? netIndex.get(n)! : null;
      };
      let els = mod.stamp({ comp: { id: comp.id, params: comp.params }, node: nodeOf, supplyVoltage: 220 });

      if (mod.isSource) {
        const valid: MnaElement[] = [];
        for (const e of els) {
          if (e.type === 'voltageSource' && e.nodeA === e.nodeB) {
            events.push({ type: 'short-circuit', message: 'Замкнуты выводы источника', target: { compId: comp.id } });
            continue;
          }
          valid.push(e);
        }
        els = valid;
        if (els.length > 0 && mod.neutralPin) {
          const n = nodeOf(mod.neutralPin);
          if (n !== null) {
            if (peNetIndex < 0) peNetIndex = nets.length;
            elements.push({ type: 'resistor', nodeA: peNetIndex, nodeB: n, R: 0.001, tag: '__pe__' });
          }
        }
      }

      els.forEach(e => elements.push({ ...e, tag: e.tag ? comp.id + ':' + e.tag : comp.id } as MnaElement));

      // Утечка на PE
      const leakageMA = Number(comp.params.leakage) || 0;
      const isGrounded = comp.params.grounded !== false;
      if (leakageMA > 0 && isGrounded && peNetIndex >= 0) {
        let phaseNetId: string | null = null;
        for (const pp of ['L', 'L1', 'V+']) {
          if (comp.pins[pp]) {
            const n = getNet(comp.id, pp);
            if (n) { phaseNetId = n; break; }
          }
        }
        if (phaseNetId) {
          const R_leak = 220 / (leakageMA / 1000);
          elements.push({ type: 'resistor', nodeA: netIndex.get(phaseNetId)!, nodeB: peNetIndex, R: R_leak, tag: comp.id + ':leak' } as MnaElement);
        }
      }
    }

    // === Решение ===
    const totalNodes = peNetIndex >= 0 ? nets.length + 1 : nets.length;
    lastResult = solveIslands(totalNodes, elements);

    // === Атрибуция токов к пинам ===
    const tagSums = new Map<string, { re: number; im: number }>();
    const pinCurrentSums = new Map<string, { re: number; im: number }>();
    componentCurrents = new Map();

    elements.forEach((el, i) => {
      if (!el.tag) return;
      const re = lastResult.iRe[i] || 0;
      const im = lastResult.iIm[i] || 0;
      const cur = Math.hypot(re, im);
      const realCompId = el.tag.split(':')[0];

      componentCurrents.set(realCompId, Math.max(componentCurrents.get(realCompId) || 0, cur));

      const s = tagSums.get(realCompId) || { re: 0, im: 0 };
      s.re += re;
      s.im += im;
      tagSums.set(realCompId, s);

      // Атрибуция к пинам — только для элементов, у которых есть реальный component
      const comp = project.components.find(c => c.id === realCompId);
      if (comp) {
        for (const pinId of Object.keys(comp.pins)) {
          const netId = getNet(comp.id, pinId);
          if (!netId) continue;
          const netIdx = netIndex.get(netId);
          if (netIdx === el.nodeA || netIdx === el.nodeB) {
            const key = comp.id + ':' + pinId;
            const ps = pinCurrentSums.get(key) || { re: 0, im: 0 };
            if (netIdx === el.nodeA) { ps.re += re; ps.im += im; }
            else { ps.re -= re; ps.im -= im; }
            pinCurrentSums.set(key, ps);
          }
        }
      }
    });

    componentNeutralCurrent = new Map();
    tagSums.forEach((s, tag) => componentNeutralCurrent.set(tag, Math.hypot(s.re, s.im)));

    pinCurrentsLocal = new Map();
    pinCurrentSums.forEach((s, key) => pinCurrentsLocal.set(key, Math.hypot(s.re, s.im)));

    // === Оценка модов ===
    let changed = false;
    for (const comp of project.components) {
      if (['supply', 'supply_3ph', 'supply_3ph_delta', 'supply_us_2ph'].includes(comp.deviceId)) continue;
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
        pinCurrent: (pinId: string) => {
          return pinCurrentsLocal.get(comp.id + ':' + pinId) || 0;
        },
        pinCurrentComplex: (pinId: string) => {
          return pinCurrentSums.get(comp.id + ':' + pinId) || { re: 0, im: 0 };
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

  // === Финальные напряжения ===
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

  // === Мощность и потери в проводах ===
  const pinPower = new Map<string, number>();
  pinCurrentsLocal.forEach((current, key) => {
    const [compId, pinId] = key.split(':');
    const vRe = pinVRe.get(compId)?.get(pinId) || 0;
    const vIm = pinVIm.get(compId)?.get(pinId) || 0;
    const vMag = Math.hypot(vRe, vIm);
    pinPower.set(key, vMag * current);
  });

  const RHO_COPPER = 0.0175;
  const RHO_ALUMINUM = 0.028;
  const wireLosses = new Map<string, { current: number; dv: number; pLoss: number; R: number; material: string; crossSection: number; length: number }>();
  for (const wire of project.wires) {
    const pinA = wire.from.compId + ':' + wire.from.pinId;
    const pinB = wire.to.compId + ':' + wire.to.pinId;
    const curA = pinCurrentsLocal.get(pinA) || 0;
    const curB = pinCurrentsLocal.get(pinB) || 0;
    const current = Math.max(curA, curB);
    const material = (wire.material || 'copper') as 'copper' | 'aluminum';
    const rho = material === 'aluminum' ? RHO_ALUMINUM : RHO_COPPER;
    const crossSection = wire.crossSection || 2.5;
    const length = wire.length || 1;
    const R = rho * length / crossSection;
    const dv = current * R;
    const pLoss = current * current * R;
    wireLosses.set(wire.id, { current, dv, pLoss, R, material, crossSection, length });
  }

  const __evKey = (e: any) => [e.type, e.message, e.target?.compId, e.target?.wireId].join('|');
  const uniqueEvents = Array.from(new Map(events.map(e => [__evKey(e), e])).values());

  return {
    netVRe, netVIm, pinVRe, pinVIm, pinNet: pinToNet, netIsland,
    islandFreq: lastResult.islandFreq,
    componentCurrents, pinCurrents: pinCurrentsLocal, pinPower, wireLosses,
    componentNeutralCurrent, visuals, events: uniqueEvents, updatedParams, debugLogs,
  };
}

export function measure(
  res: SimulationResult,
  a: { compId: string; pinId: string },
  b: { compId: string; pinId: string },
): { kind: 'ok'; volts: number; isAC: boolean; freq: number; isShorted: boolean } | { kind: 'isolated' } | { kind: 'open' } {
  const na = res.pinNet.get(a.compId + ':' + a.pinId);
  const nb = res.pinNet.get(b.compId + ':' + b.pinId);
  if (!na || !nb) return { kind: 'open' };
  const ia = res.netIsland.get(na);
  const ib = res.netIsland.get(nb);
  if (ia !== ib) return { kind: 'isolated' };
  const isShorted = na === nb;
  const freq = res.islandFreq[ia ?? 0] || 0;
  const dvRe = (res.netVRe.get(na) ?? 0) - (res.netVRe.get(nb) ?? 0);
  const dvIm = (res.netVIm.get(na) ?? 0) - (res.netVIm.get(nb) ?? 0);
  const isAC = freq > 0;
  const volts = isAC ? Math.hypot(dvRe, dvIm) : dvRe;
  return { kind: 'ok', volts, isAC, freq, isShorted };
}
