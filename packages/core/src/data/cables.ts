export type CableMaterial = 'copper' | 'aluminum';
export type CableType = 'solid' | 'stranded';

export type CableInfo = {
  section: number; // мм²
  material: CableMaterial;
  maxCurrent: number; // Ампер (длительно допустимый по ПУЭ)
};

// Таблица ПУЭ (упрощённая, для прокладки в трубе/стене)
export const CABLE_TABLE: CableInfo[] = [
  // Медь
  { section: 0.5, material: 'copper', maxCurrent: 11 },
  { section: 0.75, material: 'copper', maxCurrent: 15 },
  { section: 1.0, material: 'copper', maxCurrent: 17 },
  { section: 1.5, material: 'copper', maxCurrent: 23 },
  { section: 2.5, material: 'copper', maxCurrent: 30 },
  { section: 4.0, material: 'copper', maxCurrent: 41 },
  { section: 6.0, material: 'copper', maxCurrent: 50 },
  { section: 10.0, material: 'copper', maxCurrent: 80 },
  { section: 16.0, material: 'copper', maxCurrent: 100 },
  { section: 25.0, material: 'copper', maxCurrent: 140 },
  
  // Алюминий
  { section: 2.5, material: 'aluminum', maxCurrent: 23 },
  { section: 4.0, material: 'aluminum', maxCurrent: 30 },
  { section: 6.0, material: 'aluminum', maxCurrent: 39 },
  { section: 10.0, material: 'aluminum', maxCurrent: 55 },
  { section: 16.0, material: 'aluminum', maxCurrent: 75 },
];

export function getMaxCurrent(section: number, material: CableMaterial = 'copper'): number {
  const row = CABLE_TABLE.find(c => c.section === section && c.material === material);
  return row ? row.maxCurrent : 0;
}
