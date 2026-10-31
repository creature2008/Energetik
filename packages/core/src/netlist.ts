import { Project, Net } from './types';

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

  // 1. Добавляем ВСЕ пины в parent (чтобы у каждого был узел)
  for (const c of project.components) {
    for (const pinId of Object.keys(c.pins)) {
      const key = c.id + ':' + pinId;
      parent.set(key, key);
    }
  }

  // 2. Объединяем проводами
  for (const w of project.wires) {
    const a = w.from.compId + ':' + w.from.pinId;
    const b = w.to.compId + ':' + w.to.pinId;
    union(a, b);
  }

  // 3. Собираем группы
  const groups = new Map<string, { compId: string; pinId: string }[]>();
  for (const key of Array.from(parent.keys())) {
    const root = find(key);
    if (!groups.has(root)) groups.set(root, []);
    const i = key.indexOf(':');
    groups.get(root)!.push({ compId: key.slice(0, i), pinId: key.slice(i + 1) });
  }

  return Array.from(groups.entries()).map(([id, pins]) => ({ id, pins }));
}
