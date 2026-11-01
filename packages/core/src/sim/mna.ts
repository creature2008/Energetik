export type MnaElement =
  | { type: 'resistor'; nodeA: number; nodeB: number; R: number; tag?: string }
  | { type: 'voltageSource'; nodeA: number; nodeB: number; rms: number; phaseDeg?: number; freq: number; tag?: string };

export type MnaResult = {
  vRe: Float64Array;
  vIm: Float64Array;
  iRe: Float64Array;
  iIm: Float64Array;
  islandOf: Int32Array;
  islandFreq: number[];
};

export const mag = (re: number, im: number) => Math.hypot(re, im);

const EPS = 1e-12;

function solveComplex(n: number, Ar: Float64Array, Ai: Float64Array, br: Float64Array, bi: Float64Array) {
  let scale = 0;
  for (let k = 0; k < n * n; k++) scale = Math.max(scale, Ar[k] * Ar[k] + Ai[k] * Ai[k]);

  for (let col = 0; col < n; col++) {
    let piv = col, best = -1;
    for (let r = col; r < n; r++) {
      const m = Ar[r * n + col] ** 2 + Ai[r * n + col] ** 2;
      if (m > best) { best = m; piv = r; }
    }
    if (best <= EPS * EPS * Math.max(scale, 1)) continue;
    if (piv !== col) {
      for (let c = 0; c < n; c++) {
        [Ar[col * n + c], Ar[piv * n + c]] = [Ar[piv * n + c], Ar[col * n + c]];
        [Ai[col * n + c], Ai[piv * n + c]] = [Ai[piv * n + c], Ai[col * n + c]];
      }
      [br[col], br[piv]] = [br[piv], br[col]];
      [bi[col], bi[piv]] = [bi[piv], bi[col]];
    }
    const pr = Ar[col * n + col], pi = Ai[col * n + col], d = pr * pr + pi * pi;
    if (d < EPS) continue;
    for (let r = col + 1; r < n; r++) {
      const ar = Ar[r * n + col], ai = Ai[r * n + col];
      if (ar === 0 && ai === 0) continue;
      const fr = (ar * pr + ai * pi) / d, fi = (ai * pr - ar * pi) / d;
      for (let c = col; c < n; c++) {
        const xr = Ar[col * n + c], xi = Ai[col * n + c];
        Ar[r * n + c] -= fr * xr - fi * xi;
        Ai[r * n + c] -= fr * xi + fi * xr;
      }
      br[r] -= fr * br[col] - fi * bi[col];
      bi[r] -= fr * bi[col] + fi * br[col];
    }
  }
  const xr = new Float64Array(n), xi = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let sr = br[r], si = bi[r];
    for (let c = r + 1; c < n; c++) {
      sr -= Ar[r * n + c] * xr[c] - Ai[r * n + c] * xi[c];
      si -= Ar[r * n + c] * xi[c] + Ai[r * n + c] * xr[c];
    }
    const pr = Ar[r * n + r], pi = Ai[r * n + r], d = pr * pr + pi * pi;
    if (d < EPS) { xr[r] = 0; xi[r] = 0; continue; }
    xr[r] = (sr * pr + si * pi) / d;
    xi[r] = (si * pr - sr * pi) / d;
  }
  return { xr, xi };
}

type Island = { nodes: number[]; elems: number[]; freq: number };

function splitIslands(nodeCount: number, elements: MnaElement[]): Island[] {
  const parent = Array.from({ length: nodeCount }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const e of elements) if (e.nodeA !== e.nodeB) parent[find(e.nodeA)] = find(e.nodeB);

  const byRoot = new Map<number, Island>();
  for (let n = 0; n < nodeCount; n++) {
    const r = find(n);
    if (!byRoot.has(r)) byRoot.set(r, { nodes: [], elems: [], freq: 0 });
    byRoot.get(r)!.nodes.push(n);
  }
  elements.forEach((e, i) => {
    const r = find(e.nodeA);
    const isl = byRoot.get(r)!;
    isl.elems.push(i);
    if (e.type === 'voltageSource' && e.freq > 0) isl.freq = e.freq;
  });
  return Array.from(byRoot.values());
}

export function solveIslands(nodeCount: number, elements: MnaElement[]): MnaResult {
  const vRe = new Float64Array(nodeCount);
  const vIm = new Float64Array(nodeCount);
  const iRe = new Float64Array(elements.length);
  const iIm = new Float64Array(elements.length);
  const islandOf = new Int32Array(nodeCount).fill(-1);
  const islandFreq: number[] = [];

  let k = 0;
  for (const isl of splitIslands(nodeCount, elements)) {
    isl.nodes.forEach(n => (islandOf[n] = k));
    islandFreq.push(isl.freq);
    k++;
    if (isl.elems.length === 0) continue;

    const local = new Map(isl.nodes.map((n, i) => [n, i] as [number, number]));
    const elems = isl.elems.map(i => {
      const e = elements[i];
      return { ...e, nodeA: local.get(e.nodeA)!, nodeB: local.get(e.nodeB)!, _gi: i };
    });

    const vsCount = elems.filter(e => e.type === 'voltageSource').length;
    const n = isl.nodes.length + vsCount;
    const Ar = new Float64Array(n * n);
    const Ai = new Float64Array(n * n);
    const br = new Float64Array(n);
    const bi = new Float64Array(n);

    let vsIdx = 0;
    const vsRow = new Map<number, number>();

    elems.forEach((el, idx) => {
      if (el.type === 'resistor') {
        const g = 1 / Math.max(el.R, 1e-4);
        const a = el.nodeA, b = el.nodeB;
        if (a < isl.nodes.length) Ar[a * n + a] += g;
        if (b < isl.nodes.length) Ar[b * n + b] += g;
        if (a < isl.nodes.length && b < isl.nodes.length) {
          Ar[a * n + b] -= g;
          Ar[b * n + a] -= g;
        }
      } else if (el.type === 'voltageSource') {
        const row = isl.nodes.length + vsIdx;
        vsRow.set(el._gi, row);
        vsIdx++;
        const a = el.nodeA, b = el.nodeB;
        if (a < isl.nodes.length) { Ar[row * n + a] += 1; Ar[a * n + row] += 1; }
        if (b < isl.nodes.length) { Ar[row * n + b] -= 1; Ar[b * n + row] -= 1; }
        const phaseRad = ((el.phaseDeg || 0) * Math.PI) / 180;
        br[row] = el.rms * Math.cos(phaseRad);
        bi[row] = el.rms * Math.sin(phaseRad);
      }
    });

    // Земля = nodeB первого источника
    const vs = elems.find(e => e.type === 'voltageSource');
    if (vs) {
      const ground = vs.nodeB;
      if (ground < isl.nodes.length) {
        for (let i = 0; i < n; i++) { Ar[ground * n + i] = 0; Ai[ground * n + i] = 0; }
        Ar[ground * n + ground] = 1;
        br[ground] = 0; bi[ground] = 0;
      }
    }

    const { xr, xi } = solveComplex(n, Ar, Ai, br, bi);
    isl.nodes.forEach((origN, i) => {
      vRe[origN] = xr[i];
      vIm[origN] = xi[i];
    });

    elems.forEach(el => {
      if (el.type === 'resistor') {
        const vaRe = xr[el.nodeA] ?? 0, vaIm = xi[el.nodeA] ?? 0;
        const vbRe = xr[el.nodeB] ?? 0, vbIm = xi[el.nodeB] ?? 0;
        const g = 1 / Math.max(el.R, 1e-4);
        iRe[el._gi] = (vaRe - vbRe) * g;
        iIm[el._gi] = (vaIm - vbIm) * g;
      } else {
        const row = vsRow.get(el._gi);
        if (row !== undefined) {
          iRe[el._gi] = xr[row];
          iIm[el._gi] = xi[row];
        }
      }
    });
  }

  return { vRe, vIm, iRe, iIm, islandOf, islandFreq };
}
