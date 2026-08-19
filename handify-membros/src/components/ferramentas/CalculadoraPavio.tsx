'use client';

import { useState, useMemo, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Bookmark, BookmarkCheck, Share2, BookOpen,
  ChevronDown, Trash2, CheckCircle2, AlertCircle, ClipboardCopy,
} from 'lucide-react';
import { saveWickFormula, deleteWickFormula, updateTestNotes } from '@/lib/pavio/actions';
import type { WickRecommendation, SavedWickFormula, CandleType } from '@/lib/pavio/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTAINER_WAXES = [
  { value: 'soy',      label: 'Cera de Soja',      desc: 'EcoSoya, Golden Wax, NatureCera...', icon: '🌱' },
  { value: 'paraffin', label: 'Parafina',           desc: 'Parafina container ou vela',         icon: '🕯️' },
  { value: 'ecomix',   label: 'Ecomix',             desc: 'Blend brasileiro de soja + parafina, muito popular', icon: '🌿' },
  { value: 'coconut',  label: 'Cera de Coco',       desc: 'Coconut Wax, Coco 83...',            icon: '🥥' },
  { value: 'blend',    label: 'Outro blend',        desc: 'Mistura de ceras (não ecomix)',       icon: '🧪' },
  { value: 'beeswax',  label: 'Cera de Abelha',    desc: 'Cera de abelha pura',                icon: '🐝' },
];

const MOLD_WAXES = [
  { value: 'pillar_paraffin', label: 'Parafina de Alta Fusão', desc: 'Parafina dura específica para moldes (também chamada parafina pilar)', icon: '🕯️' },
  { value: 'soy',             label: 'Cera de Soja para Moldes', desc: 'Fórmula especial para velas sólidas — não é a mesma do pote',       icon: '🌱' },
  { value: 'blend',           label: 'Blend para Moldes',        desc: 'Mistura com alto ponto de fusão — vela fica sólida sem recipiente', icon: '🧪' },
];

const MOLD_SHAPES = [
  { value: 'cylindrical', label: 'Redondo / cilíndrico', desc: 'Forma de tubo, pilar redondo', icon: '⚫' },
  { value: 'conical',     label: 'Cônico',               desc: 'Afunila para cima ou para baixo', icon: '🔺' },
  { value: 'shaped',      label: 'Formato especial',     desc: 'Flor, coração, animais, etc.', icon: '⭐' },
];

const CONTAINER_DIAMETERS = [
  { label: '4 – 6 cm', desc: 'Pote shot ou mini',    value: 5 },
  { label: '6 – 8 cm', desc: 'Pote 150–250ml',       value: 7.5 },
  { label: '8 – 10 cm', desc: 'Pote 250–400ml',      value: 9.5 },
  { label: '10 – 12 cm', desc: 'Pote 400–600ml',     value: 11.5 },
  { label: '12 cm ou mais', desc: 'Pote grande / tigela', value: 14 },
];

const MOLD_DIAMETERS = [
  { label: '4 – 6 cm',      desc: 'Vela fina / pequena', value: 5 },
  { label: '6 – 8 cm',      desc: 'Vela média',           value: 7.5 },
  { label: '8 – 10 cm',     desc: 'Vela grande',          value: 9.5 },
  { label: '10 cm ou mais', desc: 'Vela muito grande',    value: 12 },
];

const FRAGRANCE_RANGES = [
  { label: '0 – 4%',     desc: 'Leve — sutil, quase imperceptível',    mid: 2 },
  { label: '4 – 8%',     desc: 'Médio — presente, agradável',          mid: 6,  popular: true },
  { label: '8 – 12%',    desc: 'Forte — intenso, muito aromático',     mid: 10 },
  { label: '12% ou mais', desc: 'Máximo — ultra fragrante',            mid: 14 },
];

const WAX_LABELS: Record<string, string> = {
  soy: 'Cera de Soja',
  paraffin: 'Parafina',
  ecomix: 'Ecomix',
  coconut: 'Cera de Coco',
  blend: 'Blend',
  beeswax: 'Cera de Abelha',
  pillar_paraffin: 'Parafina Alta Fusão',
};

const WICK_SERIES_INFO: Record<string, { name: string; info: string }> = {
  LX: {
    name: 'Série LX',
    info: 'Pavio de algodão trançado, um dos mais usados no Brasil para velas de soja e coco. O número indica espessura — LX 10 é mais fino, LX 22 é mais grosso. Encontre em lojas de insumos para velas.',
  },
  CD: {
    name: 'Série CD',
    info: 'Pavio de algodão trançado com núcleo de papel, queima estável. Amplamente disponível no Brasil. CD 10 é fino, CD 20 é mais grosso.',
  },
  ECO: {
    name: 'Série ECO',
    info: 'Pavio de algodão natural sem núcleo metálico, indicado para ceras vegetais e fragrâncias naturais. ECO 2 é fino, ECO 14 é mais grosso.',
  },
  'Pavio quadrado': {
    name: 'Pavio quadrado trançado',
    info: 'Pavio trançado em formato quadrado, tradicional para velas de molde (pilar). Os números indicam espessura: nº 2 = fino, nº 4 = grosso. Vendido em metros nas lojas de insumos.',
  },
};

const DIAMETER_LABELS: Record<number, string> = {
  5: '4–6 cm',
  7.5: '6–8 cm',
  9.5: '8–10 cm',
  11.5: '10–12 cm',
  14: '12+ cm',
  12: '10+ cm',
};

const FRAGRANCE_LABELS: Record<number, string> = {
  2: '0–4%',
  6: '4–8%',
  10: '8–12%',
  14: '12%+',
};

// Espessura aproximada por nome de pavio — valores de referência do mercado
// No Brasil os fornecedores anunciam como "pavio de Xmm" ou códigos B20XX / A20XX
const WICK_SIZE_MM: Record<string, string> = {
  'LX 6': '1,5',  'LX 8': '2',   'LX 10': '2,5',
  'LX 12': '3',   'LX 14': '3,5', 'LX 16': '4',
  'LX 18': '4,5', 'LX 20': '5',  'LX 22': '6',
  'CD 6': '1,5',  'CD 8': '2',   'CD 10': '2,5',
  'CD 12': '3',   'CD 14': '3,5', 'CD 16': '4',
  'CD 18': '4,5', 'CD 20': '5',
  'ECO 2': '1,5', 'ECO 3': '2',  'ECO 4': '2,5',
  'ECO 6': '3',   'ECO 8': '3,5', 'ECO 10': '4', 'ECO 12': '4,5',
  'Pavio quadrado #2': '2', 'Pavio quadrado #3': '3', 'Pavio quadrado #4': '4',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Answers = {
  candleType: CandleType | null;
  waxType: string | null;
  moldShape: string | null;
  diameterValue: number | null;
  fragranceMid: number | null;
  hasDye: boolean | null;
};

const EMPTY: Answers = {
  candleType: null,
  waxType: null,
  moldShape: null,
  diameterValue: null,
  fragranceMid: null,
  hasDye: null,
};

// ── Matching ──────────────────────────────────────────────────────────────────

function findRecommendation(recs: WickRecommendation[], a: Answers): WickRecommendation | null {
  if (!a.candleType || !a.waxType || !a.diameterValue || a.fragranceMid === null) return null;
  const matches = recs.filter(r =>
    r.candle_type === a.candleType &&
    r.wax_type === a.waxType &&
    r.diameter_min <= a.diameterValue! &&
    a.diameterValue! <= r.diameter_max &&
    r.fragrance_min <= a.fragranceMid! &&
    a.fragranceMid! <= r.fragrance_max &&
    (r.has_dye === null || r.has_dye === (a.hasDye ?? false)) &&
    (a.candleType === 'container' || r.mold_shape === null || r.mold_shape === a.moldShape),
  );
  return matches[0] ?? null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OptionCard({
  icon, label, desc, selected, onClick, badge,
}: {
  icon: string; label: string; desc?: string; selected: boolean;
  onClick: () => void; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-start gap-3 ${
        selected
          ? 'border-[#6699F3] bg-[#6699F3]/5'
          : 'border-border/60 hover:border-[#6699F3]/50 bg-white dark:bg-background'
      }`}
    >
      <span className="text-2xl mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold text-sm ${selected ? 'text-[#6699F3]' : 'text-foreground'}`}>
            {label}
          </span>
          {badge && (
            <span className="text-[10px] font-black bg-[#72CF92]/20 text-[#3a9e5c] px-2 py-0.5 rounded-full uppercase tracking-wide">
              {badge}
            </span>
          )}
        </div>
        {desc && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
        )}
      </div>
      {selected && (
        <div className="ml-auto shrink-0 w-5 h-5 rounded-full bg-[#6699F3] flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

function DiameterGuide({ type }: { type: 'container' | 'mold' }) {
  return (
    <div className="bg-[#6699F3]/5 border border-[#6699F3]/20 rounded-2xl p-4 flex flex-col items-center gap-3">
      {type === 'container' ? (
        <svg viewBox="0 0 220 100" className="w-full max-w-[220px]" aria-hidden="true">
          {/* Outer rim of container */}
          <ellipse cx="110" cy="52" rx="88" ry="36" fill="#E8EFFE" stroke="#6699F3" strokeWidth="2.5"/>
          {/* Inner opening */}
          <ellipse cx="110" cy="52" rx="72" ry="26" fill="white" stroke="#6699F3" strokeWidth="1.5" strokeDasharray="4,3"/>
          {/* Diameter arrow */}
          <line x1="38" y1="52" x2="182" y2="52" stroke="#6699F3" strokeWidth="1.5"/>
          <polygon points="38,48 38,56 28,52" fill="#6699F3"/>
          <polygon points="182,48 182,56 192,52" fill="#6699F3"/>
          {/* Label */}
          <text x="110" y="22" textAnchor="middle" fontSize="11" fontWeight="600" fill="#6699F3" fontFamily="sans-serif">diâmetro interno</text>
          <line x1="110" y1="25" x2="110" y2="45" stroke="#6699F3" strokeWidth="1" strokeDasharray="2,2"/>
        </svg>
      ) : (
        <svg viewBox="0 0 220 100" className="w-full max-w-[220px]" aria-hidden="true">
          {/* Cylinder side view */}
          <rect x="35" y="22" width="150" height="58" rx="3" fill="#E8EFFE" stroke="#6699F3" strokeWidth="2"/>
          {/* Top ellipse */}
          <ellipse cx="110" cy="22" rx="75" ry="12" fill="#D0DDFB" stroke="#6699F3" strokeWidth="2"/>
          {/* Width arrow above */}
          <line x1="35" y1="10" x2="185" y2="10" stroke="#6699F3" strokeWidth="1.5"/>
          <polygon points="35,7 35,13 25,10" fill="#6699F3"/>
          <polygon points="185,7 185,13 195,10" fill="#6699F3"/>
          {/* Label */}
          <text x="110" y="90" textAnchor="middle" fontSize="11" fontWeight="600" fill="#6699F3" fontFamily="sans-serif">diâmetro mais largo</text>
        </svg>
      )}
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        {type === 'container'
          ? 'Meça a abertura interna do pote (de borda a borda por dentro), com uma régua ou fita métrica.'
          : 'Meça o ponto mais largo do molde. Se o molde afunila, use o diâmetro maior.'}
      </p>
    </div>
  );
}

function WickInfoAccordion({ wickName }: { wickName: string }) {
  const [open, setOpen] = useState(false);
  const key = Object.keys(WICK_SERIES_INFO).find(k => wickName.startsWith(k));
  const info = key ? WICK_SERIES_INFO[key] : null;
  if (!info) return null;

  return (
    <div className="border border-border/60 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold hover:bg-muted/50 transition-colors text-left"
      >
        <span className="flex items-center gap-2">❓ O que é {info.name}?</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform text-muted-foreground ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-muted/30 border-t border-border/40 text-sm text-muted-foreground leading-relaxed">
          {info.info}
        </div>
      )}
    </div>
  );
}

function HowToTestAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/60 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold hover:bg-muted/50 transition-colors text-left"
      >
        <span className="flex items-center gap-2">🔥 Como fazer o teste de queima</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform text-muted-foreground ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-muted/30 border-t border-border/40 space-y-3 text-sm">
          <p className="font-semibold text-[#6699F3]">Protocolo de teste (4 horas)</p>
          <ol className="space-y-2 text-muted-foreground">
            {[
              'Acenda a vela em ambiente fechado, sem corrente de ar.',
              'Deixe queimar por 2 horas sem mover ou apagar.',
              'Observe: a piscina de cera deve chegar até as bordas do recipiente.',
              'Continue por mais 2 horas e verifique fumaça, temperatura e chama.',
              'Pavio correto: chama 1–2 cm, sem fumaça preta, sem "cogumelo" no topo.',
            ].map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#6699F3]/10 text-[#6699F3] text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground border-t border-border/40 pt-2">
            Piscina não chegou à borda → pavio maior. Fumaça preta → pavio menor.
          </p>
        </div>
      )}
    </div>
  );
}

function SavedFormulaCard({
  formula,
  onDelete,
}: {
  formula: SavedWickFormula;
  onDelete: (id: string) => void;
}) {
  const [, startTransition] = useTransition();
  const [notes, setNotes] = useState(formula.test_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveNotes = () => {
    setSaving(true);
    startTransition(async () => {
      await updateTestNotes(formula.id, notes);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const desc = [
    formula.candle_type === 'container' ? 'Recipiente' : 'Molde',
    WAX_LABELS[formula.wax_type] ?? formula.wax_type,
    DIAMETER_LABELS[formula.diameter] ?? `${formula.diameter} cm`,
    FRAGRANCE_LABELS[formula.fragrance_pct] ?? `${formula.fragrance_pct}%`,
    formula.has_dye ? 'com corante' : 'sem corante',
  ].join(' · ');

  return (
    <div className="border border-border/60 rounded-2xl p-4 space-y-3 bg-white dark:bg-background">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-foreground">{formula.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <button
          onClick={() => onDelete(formula.id)}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          title="Excluir fórmula"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-[#6699F3]/5 border border-[#6699F3]/20 rounded-xl px-3 py-2.5">
        <p className="text-[10px] font-black text-[#6699F3] uppercase tracking-wider mb-0.5">Pavio principal</p>
        <p className="font-bold text-foreground">{formula.wick_primary}</p>
        {formula.wick_alternatives.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Alt: {formula.wick_alternatives.join(', ')}
          </p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">Notas de teste</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Registre aqui os resultados do seu teste de queima..."
          className="w-full text-sm border border-border/60 rounded-xl px-3 py-2 min-h-[72px] resize-none bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 placeholder:text-muted-foreground/50"
          rows={3}
        />
        <button
          onClick={handleSaveNotes}
          disabled={saving || saved}
          className="mt-1.5 text-xs font-semibold text-[#6699F3] hover:text-[#5580d4] transition-colors disabled:opacity-50"
        >
          {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar notas'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CalculadoraPavio({
  recommendations,
  savedFormulas: initialSaved,
}: {
  recommendations: WickRecommendation[];
  savedFormulas: SavedWickFormula[];
}) {
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  // step 0 = candle type; 1 = wax; 2 = shape or diameter; 3 = diameter or fragrance; 4 = fragrance or dye → result (step 5)
  const totalSteps = 5;
  const isDone = step === totalSteps;

  const rec = useMemo(
    () => (isDone ? findRecommendation(recommendations, answers) : null),
    [isDone, recommendations, answers],
  );

  const back = useCallback(() => {
    if (step === 0) return;
    if (step === 1) { setAnswers(EMPTY); setStep(0); return; }
    setStep(s => s - 1);
  }, [step]);

  const advance = useCallback((patch: Partial<Answers>) => {
    setAnswers(prev => ({ ...prev, ...patch }));
    setStep(s => s + 1);
  }, []);

  const reset = useCallback(() => {
    setAnswers(EMPTY);
    setStep(0);
    setShowSaveInput(false);
    setSaveName('');
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!rec || !answers.candleType || !answers.waxType || !answers.diameterValue || answers.fragranceMid === null) return;
    const name = saveName.trim() || 'Minha Fórmula';
    setIsSaving(true);
    startTransition(async () => {
      const result = await saveWickFormula({
        name,
        candle_type: answers.candleType!,
        wax_type: answers.waxType!,
        diameter: answers.diameterValue!,
        fragrance_pct: answers.fragranceMid!,
        has_dye: answers.hasDye ?? false,
        mold_shape: answers.moldShape,
        wick_primary: rec.wick_primary,
        wick_alternatives: rec.wick_alternatives,
      });
      setIsSaving(false);
      if (result.success) {
        setSaveSuccess(true);
        setShowSaveInput(false);
        const newFormula: SavedWickFormula = {
          id: result.id ?? crypto.randomUUID(),
          user_id: '',
          name,
          candle_type: answers.candleType!,
          wax_type: answers.waxType! as SavedWickFormula['wax_type'],
          diameter: answers.diameterValue!,
          fragrance_pct: answers.fragranceMid!,
          has_dye: answers.hasDye ?? false,
          mold_shape: answers.moldShape as SavedWickFormula['mold_shape'],
          wick_primary: rec.wick_primary,
          wick_alternatives: rec.wick_alternatives,
          test_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSaved(prev => [newFormula, ...prev]);
      }
    });
  }, [rec, answers, saveName, startTransition]);

  const handleDelete = useCallback((id: string) => {
    startTransition(async () => {
      await deleteWickFormula(id);
      setSaved(prev => prev.filter(f => f.id !== id));
    });
  }, [startTransition]);

  const handleCopy = useCallback(() => {
    if (!rec) return;
    const waxLabel = WAX_LABELS[answers.waxType ?? ''] ?? answers.waxType;
    const diamLabel = DIAMETER_LABELS[answers.diameterValue ?? 0] ?? `${answers.diameterValue} cm`;
    const fragLabel = FRAGRANCE_LABELS[answers.fragranceMid ?? 0] ?? `${answers.fragranceMid}%`;
    const type = answers.candleType === 'container' ? 'Recipiente' : 'Molde';
    const dye = answers.candleType === 'container' ? (answers.hasDye ? '· com corante' : '· sem corante') : '';
    const mm = WICK_SIZE_MM[rec.wick_primary];
    const wickLine = mm ? `${rec.wick_primary} (~${mm}mm)` : rec.wick_primary;
    const altsLine = rec.wick_alternatives.map(a => WICK_SIZE_MM[a] ? `${a} (~${WICK_SIZE_MM[a]}mm)` : a).join(', ');
    const text = `🕯️ Pavio: ${wickLine} | ${waxLabel} · ${type} ${diamLabel} · ${fragLabel} frag ${dye}\nAlternativas: ${altsLine}\nVia Handify — Área de Membros`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [rec, answers]);

  // ── Wizard step content ────────────────────────────────────────────────────

  const renderStep = () => {
    // Step 0: candle type
    if (step === 0) return (
      <div className="space-y-3">
        <OptionCard
          icon="🫙"
          label="Vela em Recipiente"
          desc="Pote, copo, xícara, recipiente reutilizável"
          selected={answers.candleType === 'container'}
          onClick={() => advance({ candleType: 'container' })}
        />
        <OptionCard
          icon="🕯️"
          label="Vela em Molde"
          desc="Pilar, cônica, formato especial — vela autossustentada"
          selected={answers.candleType === 'mold'}
          onClick={() => advance({ candleType: 'mold' })}
        />
      </div>
    );

    // Step 1: wax type
    if (step === 1) {
      const waxes = answers.candleType === 'container' ? CONTAINER_WAXES : MOLD_WAXES;
      return (
        <div className="space-y-3">
          {waxes.map(w => (
            <OptionCard
              key={w.value}
              icon={w.icon}
              label={w.label}
              desc={w.desc}
              selected={answers.waxType === w.value}
              onClick={() => advance({ waxType: w.value })}
            />
          ))}
        </div>
      );
    }

    // Step 2: container → diameter | mold → shape
    if (step === 2) {
      if (answers.candleType === 'container') {
        return (
          <div className="space-y-3">
            <DiameterGuide type="container" />
            {CONTAINER_DIAMETERS.map(d => (
              <OptionCard
                key={d.value}
                icon="📏"
                label={d.label}
                desc={d.desc}
                selected={answers.diameterValue === d.value}
                onClick={() => advance({ diameterValue: d.value })}
              />
            ))}
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {MOLD_SHAPES.map(s => (
            <OptionCard
              key={s.value}
              icon={s.icon}
              label={s.label}
              desc={s.desc}
              selected={answers.moldShape === s.value}
              onClick={() => advance({ moldShape: s.value })}
            />
          ))}
        </div>
      );
    }

    // Step 3: container → fragrance | mold → diameter
    if (step === 3) {
      if (answers.candleType === 'container') {
        return (
          <div className="space-y-3">
            {FRAGRANCE_RANGES.map(f => (
              <OptionCard
                key={f.mid}
                icon="💧"
                label={f.label}
                desc={f.desc}
                selected={answers.fragranceMid === f.mid}
                onClick={() => advance({ fragranceMid: f.mid })}
                badge={f.popular ? 'Mais comum' : undefined}
              />
            ))}
          </div>
        );
      }
      return (
        <div className="space-y-3">
          <DiameterGuide type="mold" />
          {MOLD_DIAMETERS.map(d => (
            <OptionCard
              key={d.value}
              icon="📏"
              label={d.label}
              desc={d.desc}
              selected={answers.diameterValue === d.value}
              onClick={() => advance({ diameterValue: d.value })}
            />
          ))}
        </div>
      );
    }

    // Step 4: container → dye | mold → fragrance
    if (step === 4) {
      if (answers.candleType === 'container') {
        return (
          <div className="space-y-3">
            <OptionCard
              icon="🎨"
              label="Sim, uso corante"
              desc="Corante sólido, líquido ou em bloco"
              selected={answers.hasDye === true}
              onClick={() => advance({ hasDye: true })}
            />
            <OptionCard
              icon="⬜"
              label="Não, sem corante"
              desc="Vela natural, cera sem coloração"
              selected={answers.hasDye === false}
              onClick={() => advance({ hasDye: false })}
            />
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {FRAGRANCE_RANGES.slice(0, 3).map(f => (
            <OptionCard
              key={f.mid}
              icon="💧"
              label={f.label}
              desc={f.desc}
              selected={answers.fragranceMid === f.mid}
              onClick={() => advance({ fragranceMid: f.mid })}
              badge={f.popular ? 'Mais comum' : undefined}
            />
          ))}
          <OptionCard
            icon="💧"
            label="8% ou mais"
            desc="Forte — moldes geralmente suportam menos fragrância"
            selected={answers.fragranceMid === 10}
            onClick={() => advance({ fragranceMid: 10 })}
          />
        </div>
      );
    }

    return null;
  };

  const stepLabels = [
    'Tipo de vela',
    'Tipo de cera',
    answers.candleType === 'mold' ? 'Formato do molde' : 'Tamanho do recipiente',
    answers.candleType === 'mold' ? 'Diâmetro do molde' : '% de fragrância',
    answers.candleType === 'mold' ? '% de fragrância' : 'Usa corante?',
  ];

  // ── Result ─────────────────────────────────────────────────────────────────

  if (isDone) {
    if (!rec) {
      return (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-amber-800">Nenhuma recomendação encontrada</p>
            <p className="text-sm text-amber-600 mt-1">
              Ainda não temos dados para essa combinação. A administradora pode adicionar essa configuração.
            </p>
          </div>
          <button onClick={reset} className="w-full py-3 rounded-2xl border-2 border-[#6699F3] text-[#6699F3] font-semibold text-sm hover:bg-[#6699F3]/5 transition-colors">
            Tentar novamente
          </button>
        </div>
      );
    }

    const waxLabel = WAX_LABELS[answers.waxType ?? ''] ?? answers.waxType;
    const diamLabel = DIAMETER_LABELS[answers.diameterValue ?? 0] ?? `${answers.diameterValue} cm`;
    const fragLabel = FRAGRANCE_LABELS[answers.fragranceMid ?? 0] ?? `${answers.fragranceMid}%`;

    return (
      <div className="space-y-4">
        {/* Result card */}
        <div className="bg-gradient-to-br from-[#6699F3]/8 to-[#72CF92]/5 border border-[#6699F3]/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#72CF92] shrink-0" />
            <span className="text-sm font-semibold text-muted-foreground">Recomendação de pavio</span>
          </div>

          <div className="text-center py-2">
            <p className="text-[10px] font-black text-[#6699F3] uppercase tracking-widest mb-1">Pavio principal</p>
            <p className="text-3xl font-black text-foreground">{rec.wick_primary}</p>
            {WICK_SIZE_MM[rec.wick_primary] && (
              <div className="mt-2 space-y-1">
                <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                  ≈ {WICK_SIZE_MM[rec.wick_primary]}mm de espessura
                </span>
                <p className="text-[11px] text-muted-foreground mt-1">
                  No fornecedor: procure por "pavio de {WICK_SIZE_MM[rec.wick_primary]}mm"
                </p>
              </div>
            )}
          </div>

          {rec.wick_alternatives.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2">Alternativas para teste</p>
              <div className="flex flex-wrap gap-2">
                {rec.wick_alternatives.map(alt => (
                  <span key={alt} className="inline-flex items-center gap-1.5 bg-white dark:bg-background border border-border/60 text-sm font-semibold px-3 py-1 rounded-full">
                    {alt}
                    {WICK_SIZE_MM[alt] && (
                      <span className="text-[10px] text-muted-foreground font-normal">~{WICK_SIZE_MM[alt]}mm</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-[#6699F3]/10 pt-3">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1.5">Configuração</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>🕯️ {answers.candleType === 'container' ? 'Recipiente' : 'Molde'}</span>
              <span>🌿 {waxLabel}</span>
              <span>📏 {diamLabel}</span>
              <span>💧 {fragLabel} fragrância</span>
              {answers.candleType === 'container' && (
                <span>{answers.hasDye ? '🎨 Com corante' : '⬜ Sem corante'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {rec.notes && (
          <div className="bg-[#FEC649]/10 border border-[#FEC649]/30 rounded-2xl p-4">
            <p className="text-xs font-black text-amber-700 uppercase tracking-wide mb-1.5">💡 Dica de queima</p>
            <p className="text-sm text-amber-900 leading-relaxed">{rec.notes}</p>
          </div>
        )}

        {/* Wick info */}
        <WickInfoAccordion wickName={rec.wick_primary} />

        {/* How to test */}
        <HowToTestAccordion />

        {/* Course link */}
        {rec.course_lesson_id && (
          <Link
            href={`/aulas/${rec.course_lesson_id}`}
            className="flex items-center gap-3 bg-[#6699F3]/5 border border-[#6699F3]/20 rounded-2xl p-4 hover:bg-[#6699F3]/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-[#6699F3]/15 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[#6699F3]" />
            </div>
            <div>
              <p className="text-xs font-black text-[#6699F3] uppercase tracking-wide">Aula relacionada</p>
              <p className="text-sm font-semibold text-foreground">Ver aula sobre este pavio</p>
            </div>
          </Link>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-border/60 text-sm font-semibold hover:border-[#6699F3]/50 hover:text-[#6699F3] transition-all"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-[#72CF92]" /> : <ClipboardCopy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={() => { setShowSaveInput(true); setSaveName(''); setSaveSuccess(false); }}
            disabled={saveSuccess}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#6699F3] text-white text-sm font-semibold hover:bg-[#5580d4] transition-colors disabled:opacity-60"
          >
            {saveSuccess ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            {saveSuccess ? 'Salvo!' : 'Salvar'}
          </button>
        </div>

        {/* Save name input */}
        {showSaveInput && !saveSuccess && (
          <div className="border border-[#6699F3]/30 rounded-2xl p-4 space-y-3 bg-[#6699F3]/3">
            <p className="text-sm font-semibold text-foreground">Nome da fórmula</p>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Ex: Vela soja pote 200ml verão"
              className="w-full text-sm border border-border/60 rounded-xl px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 placeholder:text-muted-foreground/50"
              maxLength={60}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowSaveInput(false)}
                className="py-2.5 rounded-xl border-2 border-border/60 text-sm font-semibold text-muted-foreground hover:border-foreground/30 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="py-2.5 rounded-xl bg-[#6699F3] text-white text-sm font-semibold hover:bg-[#5580d4] transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {/* My formulas toggle */}
        {saved.length > 0 && (
          <button
            onClick={() => setShowSaved(v => !v)}
            className="w-full flex items-center justify-between py-3.5 px-4 rounded-2xl border border-border/60 text-sm font-semibold hover:bg-muted/40 transition-colors"
          >
            <span>📋 Minhas fórmulas ({saved.length})</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showSaved ? 'rotate-180' : ''}`} />
          </button>
        )}

        {showSaved && (
          <div className="space-y-3">
            {saved.map(f => (
              <SavedFormulaCard key={f.id} formula={f} onDelete={handleDelete} />
            ))}
          </div>
        )}

        <button
          onClick={reset}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-border/50 text-sm text-muted-foreground hover:border-[#6699F3]/40 hover:text-[#6699F3] transition-all"
        >
          ↩ Nova consulta
        </button>
      </div>
    );
  }

  // ── Wizard shell ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold">
            {step === 0 ? 'Tipo de vela' : stepLabels[step] ?? ''}
          </span>
          <span>{step + 1} / {totalSteps}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-[#6699F3] rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Question heading */}
      <div>
        <h2 className="text-lg font-bold text-foreground">
          {[
            'Qual tipo de vela você está fazendo?',
            'Qual cera você usa?',
            answers.candleType === 'mold' ? 'Qual é o formato do molde?' : 'Qual é o diâmetro do recipiente?',
            answers.candleType === 'mold' ? 'Qual é o diâmetro máximo do molde?' : 'Qual é a porcentagem de fragrância?',
            answers.candleType === 'mold' ? 'Qual é a porcentagem de fragrância?' : 'Você usa corante na cera?',
          ][step]}
        </h2>
        {step === 3 && answers.candleType === 'container' && (
          <p className="text-xs text-muted-foreground mt-1">Fragrância afeta a queima — pavios diferentes por concentração.</p>
        )}
      </div>

      {/* Options */}
      {renderStep()}

      {/* Back */}
      {step > 0 && (
        <button
          onClick={back}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </button>
      )}

      {/* Saved formulas from wizard home */}
      {step === 0 && saved.length > 0 && (
        <>
          <div className="border-t border-border/40 pt-4">
            <button
              onClick={() => setShowSaved(v => !v)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-2xl border border-border/60 text-sm font-semibold hover:bg-muted/40 transition-colors"
            >
              <span>📋 Minhas fórmulas ({saved.length})</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showSaved ? 'rotate-180' : ''}`} />
            </button>
            {showSaved && (
              <div className="mt-3 space-y-3">
                {saved.map(f => (
                  <SavedFormulaCard key={f.id} formula={f} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
