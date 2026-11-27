import { type ChangeEvent, useId, useState } from 'react';
import { clampToStep, effectiveAccessTime, formatCalculation, missPenaltyModelTime, speedup } from '~/lib/simulators/effective-access-time';

export type EffectiveAccessTimeSimulatorProps = {
  /** Initial cache hit rate, 0–1 (shown on a 50–100% slider). Default 0.9. */
  defaultHitRate?: number;
  /** Initial cache access time Tc in ns (1–30). Default 10. */
  defaultCacheNs?: number;
  /** Initial main memory access time Tm in ns (40–200, step 10). Default 100. */
  defaultMemoryNs?: number;
};

const HIT = { min: 50, max: 100, step: 1 } as const; // percent
const CACHE = { min: 1, max: 30, step: 1 } as const; // ns
const MEMORY = { min: 40, max: 200, step: 10 } as const; // ns

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
};

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  const id = useId();
  const text = `${value}${unit}`;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <output htmlFor={id} className="font-mono tabular-nums text-fg">
          {text}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        className="block h-6 w-full cursor-pointer accent-accent"
      />
      <div className="flex justify-between font-mono text-xs text-muted tabular-nums" aria-hidden="true">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

/**
 * Interactive calculator for the effective memory access time (IPA model h·Tc + (1−h)·Tm),
 * with the miss-penalty model shown for comparison. State lives only in this component;
 * nothing is stored or sent. Renders its default result during prerender (no browser APIs).
 */
export function EffectiveAccessTimeSimulator({ defaultHitRate = 0.9, defaultCacheNs = 10, defaultMemoryNs = 100 }: EffectiveAccessTimeSimulatorProps) {
  const titleId = useId();
  const [hitPercent, setHitPercent] = useState(() => clampToStep(defaultHitRate * 100, HIT.min, HIT.max, HIT.step));
  const [cacheNs, setCacheNs] = useState(() => clampToStep(defaultCacheNs, CACHE.min, CACHE.max, CACHE.step));
  const [memoryNs, setMemoryNs] = useState(() => clampToStep(defaultMemoryNs, MEMORY.min, MEMORY.max, MEMORY.step));

  const hitRate = hitPercent / 100;
  const eat = effectiveAccessTime(hitRate, cacheNs, memoryNs);
  const ratio = speedup(memoryNs, eat);
  const penaltyModel = missPenaltyModelTime(hitRate, cacheNs, memoryNs);
  const barPercent = Math.min(100, (eat / memoryNs) * 100);

  return (
    <section aria-labelledby={titleId} className="mb-7 min-w-0 rounded-lg border border-border bg-surface p-4 sm:p-5" data-pagefind-ignore="">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div id={titleId} className="font-bold">
          実効アクセス時間シミュレーター
        </div>
        <div className="text-xs text-muted">入力はこのページ内だけで計算されます</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Slider label="ヒット率 h" unit="%" {...HIT} value={hitPercent} onChange={setHitPercent} />
        <Slider label="キャッシュ Tc" unit=" ns" {...CACHE} value={cacheNs} onChange={setCacheNs} />
        <Slider label="メモリ Tm" unit=" ns" {...MEMORY} value={memoryNs} onChange={setMemoryNs} />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div aria-live="polite" aria-atomic="true">
          <div className="text-sm text-muted">実効アクセス時間 T = h×Tc + (1−h)×Tm</div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-3xl font-bold text-accent-text tabular-nums">
              {eat.toFixed(1)}
              <span className="ml-1 text-base font-normal text-muted">ns</span>
            </span>
            <span className="font-mono text-sm text-muted tabular-nums wrap-anywhere">= {formatCalculation(hitRate, cacheNs, memoryNs)}</span>
          </div>
          <div className="text-sm">
            メモリだけの場合（{memoryNs} ns）より <strong className="tabular-nums">約 {ratio.toFixed(1)} 倍</strong> 速い
          </div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${barPercent}%` }} />
        </div>
        <div className="mt-1 text-xs text-muted">棒の長さ: メモリだけの場合を全体としたときの T の割合（{Math.round(barPercent)}%）</div>
      </div>

      <div className="mt-4 border-t border-border pt-3 text-sm text-muted">
        <div>
          <span className="font-semibold text-fg">参考: ミスペナルティ方式（Tc + (1−h)×Tm）</span>
          <span className="ml-2 font-mono text-fg tabular-nums">{penaltyModel.toFixed(1)} ns</span>
        </div>
        <div className="text-xs leading-relaxed">
          ミスしたときも先にキャッシュを調べる時間 Tc がかかると考える方式で、上の式より {(penaltyModel - eat).toFixed(1)} ns
          長くなります。どちらの式を使うかは問題文や教科書の定義に従ってください。
        </div>
      </div>
    </section>
  );
}
