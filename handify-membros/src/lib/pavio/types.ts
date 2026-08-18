export type CandleType = 'container' | 'mold';

export type WaxType =
  | 'soy'
  | 'paraffin'
  | 'coconut'
  | 'blend'
  | 'beeswax'
  | 'pillar_paraffin';

export type MoldShape = 'cylindrical' | 'conical' | 'shaped';

export type WickRecommendation = {
  id: string;
  candle_type: CandleType;
  wax_type: WaxType;
  diameter_min: number;
  diameter_max: number;
  fragrance_min: number;
  fragrance_max: number;
  has_dye: boolean | null;
  mold_shape: MoldShape | null;
  wick_primary: string;
  wick_alternatives: string[];
  notes: string | null;
  course_lesson_id: string | null;
  priority: number;
  active: boolean;
};

export type SavedWickFormula = {
  id: string;
  user_id: string;
  name: string;
  candle_type: CandleType;
  wax_type: WaxType;
  diameter: number;
  fragrance_pct: number;
  has_dye: boolean;
  mold_shape: MoldShape | null;
  wick_primary: string;
  wick_alternatives: string[];
  test_notes: string | null;
  created_at: string;
  updated_at: string;
};
