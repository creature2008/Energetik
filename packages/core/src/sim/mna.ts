export type MnaElement = {
  type: 'resistor' | 'voltageSource';
  nodeA: number;
  nodeB: number;
  resistance?: number;
  voltage?: number;
  tag?: string;
};

export type MnaResult = {
  voltages: number[];
  currents: number[];
  islandOf: number[];
};

export function solveMna(nodeCount: number, elements: MnaElement[], groundIdx: number = -1): MnaResult {
  const voltageSources = elements.filter(e => e.type === 'voltageSource');
  const n = nodeCount + voltageSources.length;

  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const b: number[] = new Array(n).fill(0);
  let vsIndex = 0;
  const vsRowMap = new Map<number, number>();

  elements.forEach((el, idx) => {
    if (el.type === 'resistor') {
      const g = 1 / (el.resistance! || 1e-9);
      if (el.nodeA < nodeCount) A[el.nodeA][el.nodeA] += g;
      if (el.nodeB < nodeCount) A[el.nodeB][el.nodeB] += g;
      if (el.nodeA < nodeCount && el.nodeB < nodeCount) {
        A[el.nodeA][el.nodeB] -= g;
        A[el.nodeB][el.nodeA] -= g;
      }
    } else if (el.type === 'voltageSource') {
      const row = nodeCount + vsIndex;
      vsRowMap.set(idx, row);
      vsIndex++;
      if (el.nodeA < nodeCount) { A[row][el.nodeA] += 1; A[el.nodeA][row] += 1; }
      if (el.nodeB < nodeCount) { A[row][el.nodeB] -= 1; A[el.nodeB][row] -= 1; }
      b[row] = el.voltage!;
    }
  });

  if (groundIdx >= 0 && groundIdx < nodeCount) {
    for (let i = 0; i < n; i++) A[groundIdx][i] = 0;
    A[groundIdx][groundIdx] = 1;
    b[groundIdx] = 0;
  }

  const x = gaussianSolve(A, b);
  const voltages = x.slice(0, nodeCount);
  const currents: number[] = elements.map((el, idx) => {
    if (el.type === 'resistor') {
      const va = voltages[el.nodeA] ?? 0;
      const vb = voltages[el.nodeB] ?? 0;
      return (va - vb) / (el.resistance! || 1e-9);
    } else {
      const row = vsRowMap.get(idx);
      return row !== undefined ? x[row] : 0;
    }
  });

  return { voltages, currents, islandOf: new Array(nodeCount).fill(0) };
}

type Island = { nodes: number[]; elems: number[] };

function splitIslands(nodeCount: number, elements: MnaElement[]): Island[] {
  const parent = Array.from({ length: nodeCount }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const e of elements) {
    if (e.nodeA !== e.nodeB) parent[find(e.nodeA)] = find(e.nodeB);
  }

  const byRoot = new Map<number, Island>();
  for (let n = 0; n < nodeCount; n++) {
    const r = find(n);
    if (!byRoot.has(r)) byRoot.set(r, { nodes: [], elems: [] });
    byRoot.get(r)!.nodes.push(n);
  }
  elements.forEach((e, i) => byRoot.get(find(e.nodeA))!.elems.push(i));
  return Array.from(byRoot.values());
}

export function solveIslands(nodeCount: number, elements: MnaElement[]): MnaResult {
  const voltages: number[] = new Array(nodeCount).fill(0);
  const currents: number[] = new Array(elements.length).fill(0);
  const islandOf: number[] = new Array(nodeCount).fill(-1);

  let k = 0;
  for (const isl of splitIslands(nodeCount, elements)) {
    isl.nodes.forEach(n => (islandOf[n] = k));
    k++;
    if (isl.elems.length === 0) continue;
    const local = new Map(isl.nodes.map((n, i) => [n, i] as [number, number]));
    const els = isl.elems.map(i => ({
      ...elements[i],
      nodeA: local.get(elements[i].nodeA)!,
      nodeB: local.get(elements[i].nodeB)!,
    }));
    const vs = els.find(e => e.type === 'voltageSource');
    const ground = vs ? vs.nodeB : 0;

    const r = solveMna(isl.nodes.length, els, ground);
    isl.nodes.forEach((n, i) => (voltages[n] = r.voltages[i]));
    isl.elems.forEach((gi, idx) => (currents[gi] = r.currents[idx]));
  }

  return { voltages, currents, islandOf };
}

function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) continue;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) x[i] = M[i][n] || 0;
  return x;
}
