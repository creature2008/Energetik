import { create } from 'zustand';

export type PinRef = { compId: string; pinId: string };
export type Point = { x: number; y: number };
export type Wire = { id: string; from: PinRef; to: PinRef; waypoints: Point[]; color?: string; crossSection?: number; };

type UIState = {
  components: any[]; wires: Wire[]; activePin: PinRef | null;
  addComponent: (deviceId: string, x: number, y: number) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  setActivePin: (pin: PinRef | null) => void;
  addWire: (from: PinRef, to: PinRef) => void;
  removeWire: (wireId: string) => void;
  updateComponentParam: (compId: string, key: string, value: any) => void;
  insertWaypoint: (wireId: string, x: number, y: number, index: number) => void;
  updateWaypoint: (wireId: string, index: number, x: number, y: number) => void;
  removeWaypoint: (wireId: string, index: number) => void;
  setWireColor: (wireId: string, color: string) => void;
};

export const useStore = create<UIState>((set) => ({
  components: [], wires: [], activePin: null,
  addComponent: (deviceId, x, y) => set((state) => {
    const id = deviceId + '_' + Date.now();
    let pins: Record<string, any> = { L: { id: 'L' }, N: { id: 'N' } };
    let params: any = {};
    if (deviceId === 'lamp') { params.power = 100; params.voltage = 220; }
    if (deviceId === 'breaker') { params.ratedCurrent = 16; params.tripped = false; }
    if (deviceId === 'switch') { params.closed = false; } // По умолчанию выключен
    return { components: [...state.components, { id, deviceId, pins, params, x, y }] };
  }),
  updatePosition: (id, x, y) => set((state) => ({ components: state.components.map(c => c.id === id ? { ...c, x, y } : c) })),
  setActivePin: (pin) => set({ activePin: pin }),
  addWire: (from, to) => set((state) => {
    const exists = state.wires.some(w => 
      (w.from.compId === from.compId && w.from.pinId === from.pinId && w.to.compId === to.compId && w.to.pinId === to.pinId) ||
      (w.from.compId === to.compId && w.from.pinId === to.pinId && w.to.compId === from.compId && w.to.pinId === from.pinId)
    );
    if (exists) return state;
    return { wires: [...state.wires, { id: 'wire_' + Date.now(), from, to, waypoints: [], crossSection: 2.5 }], activePin: null };
  }),
  removeWire: (wireId) => set((state) => ({ wires: state.wires.filter(w => w.id !== wireId) })),
  updateComponentParam: (compId, key, value) => set((state) => ({
    components: state.components.map(c => c.id !== compId ? c : { ...c, params: { ...c.params, [key]: value } })
  })),
  insertWaypoint: (wireId, x, y, index) => set((state) => ({ wires: state.wires.map(w => { if (w.id !== wireId) return w; const n = [...w.waypoints]; n.splice(index, 0, {x,y}); return {...w, waypoints: n}; }) })),
  updateWaypoint: (wireId, index, x, y) => set((state) => ({ wires: state.wires.map(w => { if (w.id !== wireId) return w; const n = [...w.waypoints]; n[index] = {x,y}; return {...w, waypoints: n}; }) })),
  removeWaypoint: (wireId, index) => set((state) => ({ wires: state.wires.map(w => { if (w.id !== wireId) return w; return {...w, waypoints: w.waypoints.filter((_, i) => i !== index)}; }) })),
  setWireColor: (wireId, color) => set((state) => ({ wires: state.wires.map(w => w.id === wireId ? { ...w, color } : w) })),
}));

export const buildProjectForSimulation = () => {
  const state = useStore.getState();
  return {
    schemaVersion: 1,
    meta: { id: 'ui', name: 'UI', createdAt: '', updatedAt: '', appVersion: '0.1.0' },
    components: state.components.map(c => ({ id: c.id, deviceId: c.deviceId, params: c.params, pins: { L: { id: 'L' }, N: { id: 'N' } } })),
    wires: state.wires.map((w, i) => ({ id: w.id, number: i + 1, from: w.from, to: w.to, color: w.color || '#3498db', crossSection: w.crossSection || 2.5, waypoints: w.waypoints || [], routing: 'manual' })),
    nets: [],
    layout: { schematic: {}, realistic: {} },
    settings: { supply: { type: '220' }, units: 'metric' }
  } as any;
};
