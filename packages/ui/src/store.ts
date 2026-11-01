import { create } from 'zustand';
import { registry } from '@electro/core';
import type { CableSpec } from './cables';

export type PinRef = { compId: string; pinId: string };
export type Point = { x: number; y: number };
export type Wire = {
  id: string; from: PinRef; to: PinRef; waypoints: Point[];
  color?: string; crossSection?: number; length?: number; cableId?: string;
};

export type Snapshot = { components: any[]; wires: Wire[] };

type UIState = {
  components: any[];
  wires: Wire[];
  activePin: PinRef | null;
  selectedCompIds: string[];
  selectedWireIds: string[];
  clipboard: Snapshot | null;
  history: Snapshot[];
  historyIndex: number;
  selectedCable: CableSpec | null;

  setSelectedCable: (c: CableSpec | null) => void;
  addComponent: (deviceId: string, x: number, y: number) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  setActivePin: (pin: PinRef | null) => void;
  addWire: (from: PinRef, to: PinRef) => void;
  removeWire: (wireId: string) => void;
  updateWire: (wireId: string, patch: Partial<Wire>) => void;
  updateComponentParam: (compId: string, key: string, value: any) => void;
  removeComponent: (compId: string) => void;
  removeSelected: () => void;
  insertWaypoint: (wireId: string, x: number, y: number, index: number) => void;
  updateWaypoint: (wireId: string, index: number, x: number, y: number) => void;
  removeWaypoint: (wireId: string, index: number) => void;
  setWireColor: (wireId: string, color: string) => void;
  setSelection: (compIds: string[], wireIds: string[]) => void;
  toggleSelection: (compId: string) => void;
  clearSelection: () => void;
  copySelection: () => void;
  pasteSelection: (offsetX: number, offsetY: number) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  resetAllPower: () => void;
  importProject: (data: Snapshot) => void;
  applyCableToWires: (wireIds: string[], cable: CableSpec) => void;
};

const MAX_HISTORY = 100;

export const useStore = create<UIState>((set, get) => ({
  components: [],
  wires: [],
  activePin: null,
  selectedCompIds: [],
  selectedWireIds: [],
  clipboard: null,
  history: [],
  historyIndex: -1,
  selectedCable: null,

  setSelectedCable: (c) => set({ selectedCable: c }),

  pushHistory: () => set((state) => {
    const snap: Snapshot = {
      components: JSON.parse(JSON.stringify(state.components)),
      wires: JSON.parse(JSON.stringify(state.wires)),
    };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(snap);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    const idx = state.historyIndex - 1;
    const snap = state.history[idx];
    return {
      components: JSON.parse(JSON.stringify(snap.components)),
      wires: JSON.parse(JSON.stringify(snap.wires)),
      historyIndex: idx,
      selectedCompIds: [],
      selectedWireIds: [],
    };
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    const idx = state.historyIndex + 1;
    const snap = state.history[idx];
    return {
      components: JSON.parse(JSON.stringify(snap.components)),
      wires: JSON.parse(JSON.stringify(snap.wires)),
      historyIndex: idx,
      selectedCompIds: [],
      selectedWireIds: [],
    };
  }),

  addComponent: (deviceId, x, y) => {
    get().pushHistory();
    set((state) => {
      const mod = registry.get(deviceId);
      if (!mod) return state;
      const id = deviceId + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const pins: Record<string, any> = {};
      mod.pins.forEach(p => pins[p.id] = { ...p });
      const params: Record<string, any> = {};
      mod.params.forEach(p => params[p.key] = p.default);
      return { components: [...state.components, { id, deviceId, pins, params, x, y }] };
    });
  },

  updatePosition: (id, x, y) => set((state) => ({
    components: state.components.map(c => c.id === id ? { ...c, x, y } : c)
  })),

  setActivePin: (pin) => set({ activePin: pin }),

  addWire: (from, to) => {
    get().pushHistory();
    const cable = get().selectedCable;
    set((state) => {
      const exists = state.wires.some(w =>
        (w.from.compId === from.compId && w.from.pinId === from.pinId && w.to.compId === to.compId && w.to.pinId === to.pinId) ||
        (w.from.compId === to.compId && w.from.pinId === to.pinId && w.to.compId === from.compId && w.to.pinId === from.pinId)
      );
      if (exists) return { activePin: null };
      const newWire: Wire = {
        id: 'wire_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        from, to, waypoints: [], crossSection: cable ? cable.crossSection : 2.5,
        length: 1, cableId: cable?.id,
      };
      return { wires: [...state.wires, newWire], activePin: null };
    });
  },

  removeWire: (wireId) => {
    get().pushHistory();
    set((state) => ({ wires: state.wires.filter(w => w.id !== wireId) }));
  },

  updateWire: (wireId, patch) => set((state) => ({
    wires: state.wires.map(w => w.id === wireId ? { ...w, ...patch } : w),
  })),

  updateComponentParam: (compId, key, value) => {
    get().pushHistory();
    set((state) => ({
      components: state.components.map(c => c.id !== compId ? c : { ...c, params: { ...c.params, [key]: value } })
    }));
  },

  removeComponent: (compId) => {
    get().pushHistory();
    set((state) => ({
      components: state.components.filter(c => c.id !== compId),
      wires: state.wires.filter(w => w.from.compId !== compId && w.to.compId !== compId),
      selectedCompIds: state.selectedCompIds.filter(id => id !== compId),
    }));
  },

  removeSelected: () => {
    const { selectedCompIds } = get();
    if (selectedCompIds.length === 0) return;
    get().pushHistory();
    const set0 = new Set(selectedCompIds);
    set((state) => ({
      components: state.components.filter(c => !set0.has(c.id)),
      wires: state.wires.filter(w => !set0.has(w.from.compId) && !set0.has(w.to.compId)),
      selectedCompIds: [],
      selectedWireIds: [],
    }));
  },

  insertWaypoint: (wireId, x, y, index) => set((state) => ({
    wires: state.wires.map(w => {
      if (w.id !== wireId) return w;
      const n = [...w.waypoints]; n.splice(index, 0, { x, y });
      return { ...w, waypoints: n };
    })
  })),

  updateWaypoint: (wireId, index, x, y) => set((state) => ({
    wires: state.wires.map(w => {
      if (w.id !== wireId) return w;
      const n = [...w.waypoints]; n[index] = { x, y };
      return { ...w, waypoints: n };
    })
  })),

  removeWaypoint: (wireId, index) => set((state) => ({
    wires: state.wires.map(w => {
      if (w.id !== wireId) return w;
      return { ...w, waypoints: w.waypoints.filter((_, i) => i !== index) };
    })
  })),

  setWireColor: (wireId, color) => set((state) => ({
    wires: state.wires.map(w => w.id === wireId ? { ...w, color } : w)
  })),

  setSelection: (compIds, wireIds) => set({ selectedCompIds: compIds, selectedWireIds: wireIds }),

  toggleSelection: (compId) => set((state) => {
    const has = state.selectedCompIds.includes(compId);
    return { selectedCompIds: has ? state.selectedCompIds.filter(id => id !== compId) : [...state.selectedCompIds, compId] };
  }),

  clearSelection: () => set({ selectedCompIds: [], selectedWireIds: [] }),

  copySelection: () => set((state) => {
    const comps = state.components.filter(c => state.selectedCompIds.includes(c.id));
    if (comps.length === 0) return { clipboard: null };
    const compIds = new Set(comps.map(c => c.id));
    const wires = state.wires.filter(w => compIds.has(w.from.compId) && compIds.has(w.to.compId));
    return { clipboard: JSON.parse(JSON.stringify({ components: comps, wires })) };
  }),

  pasteSelection: (offsetX, offsetY) => {
    const cb = get().clipboard;
    if (!cb || cb.components.length === 0) return;
    get().pushHistory();
    set((state) => {
      const idMap = new Map<string, string>();
      const newComps = cb.components.map(c => {
        const newId = c.deviceId + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        idMap.set(c.id, newId);
        return { ...JSON.parse(JSON.stringify(c)), id: newId, x: c.x + offsetX, y: c.y + offsetY };
      });
      const newWires = cb.wires.map(w => ({
        ...JSON.parse(JSON.stringify(w)),
        id: 'wire_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        from: { compId: idMap.get(w.from.compId)!, pinId: w.from.pinId },
        to: { compId: idMap.get(w.to.compId)!, pinId: w.to.pinId },
      }));
      return {
        components: [...state.components, ...newComps],
        wires: [...state.wires, ...newWires],
        selectedCompIds: newComps.map(c => c.id),
        selectedWireIds: [],
      };
    });
  },

  resetAllPower: () => {
    get().pushHistory();
    set((state) => ({
      components: state.components.map(c => {
        if (c.deviceId.startsWith('breaker')) return { ...c, params: { ...c.params, tripped: false } };
        if (c.deviceId.startsWith('switch')) {
          const np = { ...c.params };
          for (const k of Object.keys(np)) if (k.startsWith('closed')) np[k] = false;
          return { ...c, params: np };
        }
        return c;
      }),
    }));
  },

  importProject: (data) => {
    get().pushHistory();
    const components = (data.components || []).map(hydrateComponent);
    set({ components, wires: data.wires || [], selectedCompIds: [], selectedWireIds: [] });
  },

  applyCableToWires: (wireIds, cable) => {
    get().pushHistory();
    const set0 = new Set(wireIds);
    set((state) => ({
      wires: state.wires.map(w => set0.has(w.id) ? { ...w, cableId: cable.id, crossSection: cable.crossSection } : w),
    }));
  },
}));

const DEVICE_ALIASES: Record<string, string> = {
  socket: 'socket_16a',
  socket_32a_2p: 'socket_32a',
  switch: 'switch_1',
  terminal_4: 'terminal',
};

function hydrateComponent(comp: any): any {
  let deviceId = DEVICE_ALIASES[comp.deviceId] || comp.deviceId;
  const mod = registry.get(deviceId);
  if (!mod) return comp;
  const params: Record<string, any> = { ...comp.params };
  mod.params.forEach(p => { if (params[p.key] === undefined) params[p.key] = p.default; });
  const pins: Record<string, any> = { ...comp.pins };
  mod.pins.forEach(p => { if (!pins[p.id]) pins[p.id] = { ...p }; });
  return { ...comp, deviceId, params, pins };
}

export const loadProjectData = (data: { components: any[], wires: any[] }) => {
  useStore.getState().importProject({ components: data.components || [], wires: data.wires || [] });
};

export const buildProjectForSimulation = () => {
  const state = useStore.getState();
  return {
    schemaVersion: 1,
    meta: { id: 'ui', name: 'UI', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
    components: state.components.map(c => ({
      id: c.id, deviceId: c.deviceId, params: c.params,
      pins: Object.fromEntries(Object.keys(c.pins).map(id => [id, { id }]))
    })),
    wires: state.wires.map((w, i) => ({
      id: w.id, number: i + 1, from: w.from, to: w.to,
      color: w.color || '#3498db', crossSection: w.crossSection || 2.5,
      waypoints: w.waypoints || [], routing: 'manual'
    })),
    nets: [],
    layout: { schematic: {}, realistic: {} },
    settings: { supply: { type: '220' }, units: 'metric' }
  } as any;
};
