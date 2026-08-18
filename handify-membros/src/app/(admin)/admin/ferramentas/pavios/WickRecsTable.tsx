'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { createWickRec, updateWickRec, toggleWickRec, deleteWickRec, type WickRecInput } from './actions';
import type { WickRecommendation } from '@/lib/pavio/types';

const WAX_LABELS: Record<string, string> = {
  soy: 'Soja',
  paraffin: 'Parafina',
  coconut: 'Coco',
  blend: 'Blend',
  beeswax: 'Abelha',
  pillar_paraffin: 'Parafina Pilar',
};

const EMPTY_INPUT: WickRecInput = {
  candle_type: 'container',
  wax_type: 'soy',
  diameter_min: 4,
  diameter_max: 7,
  fragrance_min: 0,
  fragrance_max: 8,
  has_dye: null,
  mold_shape: null,
  wick_primary: '',
  wick_alternatives: [],
  notes: null,
  course_lesson_id: null,
  priority: 10,
  active: true,
};

function RecModal({
  rec,
  onClose,
}: {
  rec: WickRecommendation | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<WickRecInput>(rec ? {
    candle_type: rec.candle_type,
    wax_type: rec.wax_type,
    diameter_min: rec.diameter_min,
    diameter_max: rec.diameter_max,
    fragrance_min: rec.fragrance_min,
    fragrance_max: rec.fragrance_max,
    has_dye: rec.has_dye,
    mold_shape: rec.mold_shape,
    wick_primary: rec.wick_primary,
    wick_alternatives: rec.wick_alternatives,
    notes: rec.notes,
    course_lesson_id: rec.course_lesson_id,
    priority: rec.priority,
    active: rec.active,
  } : EMPTY_INPUT);

  const [altsRaw, setAltsRaw] = useState(rec?.wick_alternatives.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();

  const set = <K extends keyof WickRecInput>(k: K, v: WickRecInput[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = () => {
    if (!form.wick_primary.trim()) { setError('Pavio principal obrigatório.'); return; }
    setSaving(true);
    const input = { ...form, wick_alternatives: altsRaw.split(',').map(s => s.trim()).filter(Boolean) };
    startTransition(async () => {
      const result = rec
        ? await updateWickRec(rec.id, input)
        : await createWickRec(input);
      setSaving(false);
      if (!result.success) { setError(result.error ?? 'Erro ao salvar.'); return; }
      onClose();
    });
  };

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      {node}
    </div>
  );

  const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className="w-full border border-border/60 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
    />
  );

  const sel = (value: string, onChange: (v: string) => void, opts: { v: string; l: string }[]) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-border/60 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
    >
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold">{rec ? 'Editar recomendação' : 'Nova recomendação'}</h2>

          <div className="grid grid-cols-2 gap-3">
            {field('Tipo de vela', sel(form.candle_type, v => set('candle_type', v as 'container' | 'mold'), [
              { v: 'container', l: 'Recipiente' },
              { v: 'mold', l: 'Molde' },
            ]))}
            {field('Tipo de cera', inp({
              type: 'text', value: form.wax_type,
              onChange: e => set('wax_type', e.target.value),
              placeholder: 'soy, paraffin, blend...',
            }))}
            {field('Diâmetro mín. (cm)', inp({ type: 'number', value: form.diameter_min, step: 0.5, onChange: e => set('diameter_min', parseFloat(e.target.value)) }))}
            {field('Diâmetro máx. (cm)', inp({ type: 'number', value: form.diameter_max, step: 0.5, onChange: e => set('diameter_max', parseFloat(e.target.value)) }))}
            {field('Fragrância mín. (%)', inp({ type: 'number', value: form.fragrance_min, step: 0.5, onChange: e => set('fragrance_min', parseFloat(e.target.value)) }))}
            {field('Fragrância máx. (%)', inp({ type: 'number', value: form.fragrance_max, step: 0.5, onChange: e => set('fragrance_max', parseFloat(e.target.value)) }))}
            {field('Prioridade', inp({ type: 'number', value: form.priority, onChange: e => set('priority', parseInt(e.target.value)) }))}
            {field('Corante', sel(
              form.has_dye === null ? 'null' : form.has_dye ? 'true' : 'false',
              v => set('has_dye', v === 'null' ? null : v === 'true'),
              [{ v: 'null', l: 'Qualquer (ignora)' }, { v: 'true', l: 'Com corante' }, { v: 'false', l: 'Sem corante' }],
            ))}
          </div>

          {form.candle_type === 'mold' && field('Formato do molde', sel(
            form.mold_shape ?? 'null',
            v => set('mold_shape', v === 'null' ? null : v),
            [{ v: 'null', l: 'Qualquer (ignora)' }, { v: 'cylindrical', l: 'Cilíndrico' }, { v: 'conical', l: 'Cônico' }, { v: 'shaped', l: 'Formato especial' }],
          ))}

          {field('Pavio principal *', inp({ type: 'text', value: form.wick_primary, onChange: e => set('wick_primary', e.target.value), placeholder: 'Ex: LX 14' }))}
          {field('Alternativas (separadas por vírgula)', inp({ type: 'text', value: altsRaw, onChange: e => setAltsRaw(e.target.value), placeholder: 'Ex: CD 14, ECO 6' }))}
          {field('Notas / dica de queima', (
            <textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value || null)}
              rows={3}
              className="w-full border border-border/60 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 resize-none"
              placeholder="Dica exibida para a aluna no resultado..."
            />
          ))}
          {field('ID da aula (UUID, opcional)', inp({ type: 'text', value: form.course_lesson_id ?? '', onChange: e => set('course_lesson_id', e.target.value || null), placeholder: 'UUID da aula relacionada' }))}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.active} onChange={e => set('active', e.target.checked)} className="rounded" />
            <label htmlFor="active" className="text-sm font-medium">Ativa</label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={onClose} className="py-3 rounded-2xl border-2 border-border/60 text-sm font-semibold text-muted-foreground hover:border-foreground/30 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="py-3 rounded-2xl bg-[#6699F3] text-white text-sm font-semibold hover:bg-[#5580d4] transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WickRecsTable({ recs: initial }: { recs: WickRecommendation[] }) {
  const [recs, setRecs] = useState(initial);
  const [editRec, setEditRec] = useState<WickRecommendation | null | 'new'>('new' as unknown as null);
  const [showModal, setShowModal] = useState(false);
  const [, startTransition] = useTransition();

  const openNew = () => { setEditRec(null); setShowModal(true); };
  const openEdit = (r: WickRecommendation) => { setEditRec(r); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditRec(null); };

  const handleToggle = (id: string, active: boolean) => {
    startTransition(async () => {
      await toggleWickRec(id, active);
      setRecs(prev => prev.map(r => r.id === id ? { ...r, active } : r));
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Deletar esta recomendação?')) return;
    startTransition(async () => {
      await deleteWickRec(id);
      setRecs(prev => prev.filter(r => r.id !== id));
    });
  };

  const grouped = recs.reduce<Record<string, WickRecommendation[]>>((acc, r) => {
    const key = `${r.candle_type}__${r.wax_type}`;
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      {showModal && (
        <RecModal
          rec={editRec as WickRecommendation | null}
          onClose={closeModal}
        />
      )}

      <div className="space-y-6">
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6699F3] text-white text-sm font-semibold hover:bg-[#5580d4] transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova recomendação
        </button>

        {Object.entries(grouped).map(([key, rows]) => {
          const [type, wax] = key.split('__');
          return (
            <div key={key} className="border border-border/60 rounded-2xl overflow-hidden">
              <div className="bg-muted/30 px-4 py-2.5 border-b border-border/40">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  {type === 'container' ? 'Recipiente' : 'Molde'} · {WAX_LABELS[wax] ?? wax}
                </p>
              </div>
              <div className="divide-y divide-border/40">
                {rows.map(r => (
                  <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${!r.active ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{r.wick_primary}</span>
                        <span className="text-xs text-muted-foreground">
                          ∅ {r.diameter_min}–{r.diameter_max} cm · {r.fragrance_min}–{r.fragrance_max}% frag
                        </span>
                      </div>
                      {r.wick_alternatives.length > 0 && (
                        <p className="text-xs text-muted-foreground">Alt: {r.wick_alternatives.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggle(r.id, !r.active)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={r.active ? 'Desativar' : 'Ativar'}
                      >
                        {r.active
                          ? <ToggleRight className="w-5 h-5 text-[#72CF92]" />
                          : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-[#6699F3] transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
