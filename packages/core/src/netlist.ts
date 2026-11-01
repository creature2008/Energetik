import { Project, Net } from './types';
import { registry } from './registry';

export function buildNetlist(project: Project): Net[] {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }

  function union(a: string, b: string) {
    parent.set(find(a), find(b));
  }

  // Все пины из модов
  for (const comp of project.components) {
    const mod = registry.get(comp.deviceId);
    if (!mod) continue;
    for (const pin of mod.pins) {
      parent.set(comp.id + ':' + pin.id, comp.id + ':' + pin.id);
    }
  }

  for (const w of project.wires) {
    union(w.from.compId + ':' + w.from.pinId, w.to.compId + ':' + w.to.pinId);
  }

  const groups = new Map<string, { compId: string; pinId: string }[]>();
  for (const key of Array.from(parent.keys())) {
    const root = find(key);
    if (!groups.has(root)) groups.set(root, []);
    const i = key.indexOf(':');
    groups.get(root)!.push({ compId: key.slice(0, i), pinId: key.slice(i + 1) });
  }

  return Array.from(groups.entries()).map(([id, pins]) => ({ id, pins }));
}
