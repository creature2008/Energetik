import type { MnaElement } from './sim/mna';

export type PinDef = { id: string; label: string; side: 'left' | 'right'; color?: string };

export type ParamDef = {
  key: string; label: string; type: 'number' | 'select' | 'boolean';
  default: number | string | boolean;
  options?: { value: string | number; label: string }[];
};

export interface StampCtx {
  comp: { id: string; params: Record<string, any> };
  node(pinId: string): number | null;
  supplyVoltage: number;
}

export interface EvalCtx {
  comp: { id: string; params: Record<string, any> };
  volts(a: string, b: string): number;
  current: number;
  isIsolated(a: string, b: string): boolean;
}

export interface Visual {
  glow?: number;
  spinning?: boolean;
  label?: string;
  tint?: string;
}

export type SimEvent = {
  type: 'short-circuit' | 'overload' | 'tripped' | 'burnt' | 'info';
  message: string;
  target?: { compId?: string; wireId?: string };
};

export type EvalResult = {
  events?: SimEvent[];
  setParams?: Record<string, any>;
  visual?: Visual;
};

export interface DeviceMod {
  id: string;
  name: string;
  category: string;
  size: { w: number; h: number };
  icon?: string;
  pins: PinDef[];
  params: ParamDef[];
  stamp(ctx: StampCtx): MnaElement[];
  evaluate?(ctx: EvalCtx): EvalResult;
}
