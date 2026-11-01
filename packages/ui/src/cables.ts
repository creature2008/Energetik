export type CableMaterial = 'copper' | 'aluminum';
export type CableFlexibility = 'solid' | 'stranded';

export type CableSpec = {
  id: string;
  mark: string;
  material: CableMaterial;
  flexibility: CableFlexibility;
  cores: number;
  crossSection: number;
  display: string;
  currentRating: number;
};

// Токи — ПУЭ табл. 1.3.4–1.3.6, для прокладки в трубе (2-4 одножильных в трубе)
export const CABLES: CableSpec[] = [
  // ШВВП — медь, многожильный гибкий шнур
  { id: 'shvvp-2x0.5',  mark: 'ШВВП', material: 'copper', flexibility: 'stranded', cores: 2, crossSection: 0.5,  display: 'ШВВП 2×0.5',  currentRating: 6 },
  { id: 'shvvp-2x0.75', mark: 'ШВВП', material: 'copper', flexibility: 'stranded', cores: 2, crossSection: 0.75, display: 'ШВВП 2×0.75', currentRating: 10 },
  { id: 'shvvp-2x1.5',  mark: 'ШВВП', material: 'copper', flexibility: 'stranded', cores: 2, crossSection: 1.5,  display: 'ШВВП 2×1.5',  currentRating: 16 },
  { id: 'shvvp-3x0.75', mark: 'ШВВП', material: 'copper', flexibility: 'stranded', cores: 3, crossSection: 0.75, display: 'ШВВП 3×0.75', currentRating: 10 },
  { id: 'shvvp-3x1.5',  mark: 'ШВВП', material: 'copper', flexibility: 'stranded', cores: 3, crossSection: 1.5,  display: 'ШВВП 3×1.5',  currentRating: 16 },

  // ПВС — медь, многожильный
  { id: 'pvs-2x0.75', mark: 'ПВС', material: 'copper', flexibility: 'stranded', cores: 2, crossSection: 0.75, display: 'ПВС 2×0.75', currentRating: 10 },
  { id: 'pvs-2x1.5',  mark: 'ПВС', material: 'copper', flexibility: 'stranded', cores: 2, crossSection: 1.5,  display: 'ПВС 2×1.5',  currentRating: 16 },
  { id: 'pvs-2x2.5',  mark: 'ПВС', material: 'copper', flexibility: 'stranded', cores: 2, crossSection: 2.5,  display: 'ПВС 2×2.5',  currentRating: 21 },
  { id: 'pvs-3x1.5',  mark: 'ПВС', material: 'copper', flexibility: 'stranded', cores: 3, crossSection: 1.5,  display: 'ПВС 3×1.5',  currentRating: 16 },
  { id: 'pvs-3x2.5',  mark: 'ПВС', material: 'copper', flexibility: 'stranded', cores: 3, crossSection: 2.5,  display: 'ПВС 3×2.5',  currentRating: 21 },

  // ВВГ — медь, одножильный
  { id: 'vvg-2x1.5',  mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 2, crossSection: 1.5,  display: 'ВВГ 2×1.5',  currentRating: 16 },
  { id: 'vvg-2x2.5',  mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 2, crossSection: 2.5,  display: 'ВВГ 2×2.5',  currentRating: 21 },
  { id: 'vvg-3x1.5',  mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 3, crossSection: 1.5,  display: 'ВВГ 3×1.5',  currentRating: 16 },
  { id: 'vvg-3x2.5',  mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 3, crossSection: 2.5,  display: 'ВВГ 3×2.5',  currentRating: 21 },
  { id: 'vvg-3x4',    mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 3, crossSection: 4,    display: 'ВВГ 3×4',    currentRating: 27 },
  { id: 'vvg-3x6',    mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 3, crossSection: 6,    display: 'ВВГ 3×6',    currentRating: 34 },
  { id: 'vvg-4x1.5',  mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 4, crossSection: 1.5,  display: 'ВВГ 4×1.5',  currentRating: 16 },
  { id: 'vvg-4x2.5',  mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 4, crossSection: 2.5,  display: 'ВВГ 4×2.5',  currentRating: 21 },
  { id: 'vvg-5x1.5',  mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 1.5,  display: 'ВВГ 5×1.5',  currentRating: 16 },
  { id: 'vvg-5x2.5',  mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 2.5,  display: 'ВВГ 5×2.5',  currentRating: 21 },
  { id: 'vvg-5x4',    mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 4,    display: 'ВВГ 5×4',    currentRating: 27 },
  { id: 'vvg-5x6',    mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 6,    display: 'ВВГ 5×6',    currentRating: 34 },
  { id: 'vvg-5x10',   mark: 'ВВГ', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 10,   display: 'ВВГ 5×10',   currentRating: 50 },

  // ВВГнг-LS — медь, негорючий
  { id: 'vvgng-3x1.5', mark: 'ВВГнг-LS', material: 'copper', flexibility: 'solid', cores: 3, crossSection: 1.5, display: 'ВВГнг-LS 3×1.5', currentRating: 16 },
  { id: 'vvgng-3x2.5', mark: 'ВВГнг-LS', material: 'copper', flexibility: 'solid', cores: 3, crossSection: 2.5, display: 'ВВГнг-LS 3×2.5', currentRating: 21 },
  { id: 'vvgng-5x2.5', mark: 'ВВГнг-LS', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 2.5, display: 'ВВГнг-LS 5×2.5', currentRating: 21 },
  { id: 'vvgng-5x10',  mark: 'ВВГнг-LS', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 10,  display: 'ВВГнг-LS 5×10',  currentRating: 50 },

  // NYM — медь, немецкий
  { id: 'nym-3x1.5', mark: 'NYM', material: 'copper', flexibility: 'solid', cores: 3, crossSection: 1.5, display: 'NYM 3×1.5', currentRating: 16 },
  { id: 'nym-3x2.5', mark: 'NYM', material: 'copper', flexibility: 'solid', cores: 3, crossSection: 2.5, display: 'NYM 3×2.5', currentRating: 21 },
  { id: 'nym-5x1.5', mark: 'NYM', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 1.5, display: 'NYM 5×1.5', currentRating: 16 },
  { id: 'nym-5x2.5', mark: 'NYM', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 2.5, display: 'NYM 5×2.5', currentRating: 21 },
  { id: 'nym-5x10',  mark: 'NYM', material: 'copper', flexibility: 'solid', cores: 5, crossSection: 10,  display: 'NYM 5×10',  currentRating: 50 },

  // АВВГ — алюминий, одножильный
  { id: 'avvg-2x2.5', mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 2, crossSection: 2.5, display: 'АВВГ 2×2.5', currentRating: 19 },
  { id: 'avvg-2x4',   mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 2, crossSection: 4,   display: 'АВВГ 2×4',   currentRating: 28 },
  { id: 'avvg-2x6',   mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 2, crossSection: 6,   display: 'АВВГ 2×6',   currentRating: 32 },
  { id: 'avvg-3x2.5', mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 3, crossSection: 2.5, display: 'АВВГ 3×2.5', currentRating: 19 },
  { id: 'avvg-3x4',   mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 3, crossSection: 4,   display: 'АВВГ 3×4',   currentRating: 28 },
  { id: 'avvg-3x6',   mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 3, crossSection: 6,   display: 'АВВГ 3×6',   currentRating: 32 },
  { id: 'avvg-4x2.5', mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 4, crossSection: 2.5, display: 'АВВГ 4×2.5', currentRating: 19 },
  { id: 'avvg-4x4',   mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 4, crossSection: 4,   display: 'АВВГ 4×4',   currentRating: 28 },
  { id: 'avvg-5x2.5', mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 5, crossSection: 2.5, display: 'АВВГ 5×2.5', currentRating: 19 },
  { id: 'avvg-5x4',   mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 5, crossSection: 4,   display: 'АВВГ 5×4',   currentRating: 28 },
  { id: 'avvg-5x6',   mark: 'АВВГ', material: 'aluminum', flexibility: 'solid', cores: 5, crossSection: 6,   display: 'АВВГ 5×6',   currentRating: 32 },

  // АВВГнг-LS — алюминий, негорючий
  { id: 'avvgng-3x2.5', mark: 'АВВГнг-LS', material: 'aluminum', flexibility: 'solid', cores: 3, crossSection: 2.5, display: 'АВВГнг-LS 3×2.5', currentRating: 19 },
  { id: 'avvgng-3x4',   mark: 'АВВГнг-LS', material: 'aluminum', flexibility: 'solid', cores: 3, crossSection: 4,   display: 'АВВГнг-LS 3×4',   currentRating: 28 },
  { id: 'avvgng-5x4',   mark: 'АВВГнг-LS', material: 'aluminum', flexibility: 'solid', cores: 5, crossSection: 4,   display: 'АВВГнг-LS 5×4',   currentRating: 28 },
  { id: 'avvgng-5x6',   mark: 'АВВГнг-LS', material: 'aluminum', flexibility: 'solid', cores: 5, crossSection: 6,   display: 'АВВГнг-LS 5×6',   currentRating: 32 },

  // КГ — медь, гибкий, переносной
  { id: 'kg-3x1.5', mark: 'КГ', material: 'copper', flexibility: 'stranded', cores: 3, crossSection: 1.5, display: 'КГ 3×1.5', currentRating: 16 },
  { id: 'kg-3x2.5', mark: 'КГ', material: 'copper', flexibility: 'stranded', cores: 3, crossSection: 2.5, display: 'КГ 3×2.5', currentRating: 21 },
  { id: 'kg-4x4',   mark: 'КГ', material: 'copper', flexibility: 'stranded', cores: 4, crossSection: 4,   display: 'КГ 4×4',   currentRating: 27 },
];

export function getCableById(id: string): CableSpec | undefined {
  return CABLES.find(c => c.id === id);
}
