export type Point = { x: number; y: number };

export type PinState = {
  id: string;
  voltage: number | null;
  current: number | null;
};

export type Component = {
  id: string;
  deviceId: string;
  params: Record<string, number | string | boolean>;
  pins: Record<string, PinState>;
};

export type Wire = {
  id: string;
  number: number;
  from: { compId: string; pinId: string };
  to: { compId: string; pinId: string };
  color: string;
  crossSection: number;
  waypoints: Point[];
  routing: 'auto45' | 'manual';
};

export type Net = {
  id: string;
  pins: { compId: string; pinId: string }[];
};

export type Project = {
  schemaVersion: number;
  meta: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    appVersion: string;
  };
  components: Component[];
  wires: Wire[];
  nets: Net[];
  layout: {
    schematic: Record<string, Point>;
    realistic: Record<string, Point>;
  };
  settings: {
    supply: { type: '220' | '380' | '12' | '5' };
    units: 'metric';
  };
};
