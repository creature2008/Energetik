export function buildNetlist(project) {
    const parent = new Map();
    function find(x) {
        if (!parent.has(x))
            parent.set(x, x);
        if (parent.get(x) !== x)
            parent.set(x, find(parent.get(x)));
        return parent.get(x);
    }
    function union(a, b) {
        parent.set(find(a), find(b));
    }
    for (const w of project.wires) {
        const a = w.from.compId + ':' + w.from.pinId;
        const b = w.to.compId + ':' + w.to.pinId;
        union(a, b);
    }
    const groups = new Map();
    for (const [key] of parent) {
        const root = find(key);
        if (!groups.has(root))
            groups.set(root, []);
        const parts = key.split(':');
        groups.get(root).push({ compId: parts[0], pinId: parts[1] });
    }
    return Array.from(groups.entries()).map(([id, pins]) => ({ id, pins }));
}
