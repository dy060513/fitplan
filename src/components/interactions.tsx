import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cx } from './ui'

/**
 * 6 个交互组件（参考「小程序里的组件交互」）
 * 01 标签多选  TagMultiSelect
 * 02 删除与补位 RemovableChips
 * 03 输入联想  SuggestInput
 * 04 刻度调节  DialAdjuster
 * 05 按压反馈  （已并入 ui.Button：active:scale 回弹）
 * 06 长按确认  HoldButton（波形动画，替代二次确认弹窗）
 */

/* --------------------------- 01 标签多选 --------------------------- */

export function TagMultiSelect<T extends string>({
  options,
  values,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string }[]
  values: T[]
  onChange: (next: T[]) => void
  size?: 'sm' | 'md'
}) {
  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = values.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cx(
              'inline-flex items-center gap-1 rounded-full border font-medium transition-all duration-150 select-none active:scale-95',
              size === 'sm' ? 'min-h-[32px] px-3 text-[12px]' : 'min-h-[40px] px-3.5 text-[14px]',
              active
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
            )}
          >
            <span
              className={cx(
                'inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none transition-all',
                active
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-300 text-transparent dark:border-slate-600',
              )}
            >
              ✓
            </span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------- 02 删除与补位 --------------------------- */

export function RemovableChips({
  items,
  onRemove,
  empty,
}: {
  items: { id: string; label: string }[]
  onRemove: (id: string) => void
  empty?: string
}) {
  if (!items.length)
    return <p className="text-[12px] text-slate-400 dark:text-slate-500">{empty ?? '暂无'}</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <span
          key={it.id}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-slate-100 pl-3 pr-1.5 text-[12px] text-slate-700 transition-all duration-200 dark:bg-slate-800 dark:text-slate-200"
        >
          {it.label}
          <button
            type="button"
            aria-label={`删除${it.label}`}
            onClick={() => onRemove(it.id)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition active:scale-90 active:bg-slate-200 active:text-slate-600 dark:active:bg-slate-700"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}

/* ---------------------------- 03 输入联想 ---------------------------- */

export function SuggestInput({
  value,
  onChange,
  suggestions,
  onPick,
  placeholder,
  max = 6,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: { id: string; label: string; hint?: string; disabled?: boolean }[]
  onPick: (id: string) => void
  placeholder?: string
  max?: number
}) {
  const [focus, setFocus] = useState(false)
  const list = useMemo(() => {
    const q = value.trim().toLowerCase()
    const pool = q ? suggestions.filter((s) => s.label.toLowerCase().includes(q)) : suggestions
    return pool.slice(0, max)
  }, [suggestions, value, max])

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {focus && list.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={s.disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (s.disabled) return
                onPick(s.id)
              }}
              className={cx(
                'flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-left text-[14px] transition active:bg-slate-50 dark:active:bg-slate-800',
                s.disabled
                  ? 'text-slate-400 dark:text-slate-500'
                  : 'text-slate-700 dark:text-slate-200',
              )}
            >
              <span className="truncate">{s.label}</span>
              {s.hint && <span className="shrink-0 text-[12px] text-slate-400">{s.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------- 04 刻度调节 ---------------------------- */

const TICK_W = 12 // 每格像素宽度

export function DialAdjuster({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  label?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scrubbing = useRef(false)
  const count = Math.round((max - min) / step)

  // 外部值变化时同步滚动位置（用户拖动中不同步，避免打架）
  useEffect(() => {
    const el = ref.current
    if (!el || scrubbing.current) return
    el.scrollLeft = ((value - min) / step) * TICK_W - el.clientWidth / 2 + TICK_W / 2
  }, [value, min, step])

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const idx = Math.round((el.scrollLeft + el.clientWidth / 2 - TICK_W / 2) / TICK_W)
    const clamped = Math.max(0, Math.min(count, idx))
    const v = Math.round((min + clamped * step) * 100) / 100
    if (v !== value) onChange(v)
  }

  return (
    <div>
      <div className="mb-1 flex items-end justify-between">
        {label}
        <span className="text-[17px] font-semibold text-brand-600 dark:text-brand-400">
          {value}
          {unit && <span className="ml-0.5 text-[12px] font-normal text-slate-400">{unit}</span>}
        </span>
      </div>
      <div className="relative">
        {/* 中心指针 */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-8 w-[2px] -translate-x-1/2 bg-brand-500" />
        <div
          ref={ref}
          onScroll={handleScroll}
          onTouchStart={() => (scrubbing.current = true)}
          onTouchEnd={() => (scrubbing.current = false)}
          onMouseDown={() => (scrubbing.current = true)}
          onMouseUp={() => (scrubbing.current = false)}
          className="no-scrollbar overflow-x-auto py-1"
        >
          <div className="flex" style={{ width: count * TICK_W + 400, paddingLeft: 200, paddingRight: 200 }}>
            {Array.from({ length: count + 1 }, (_, i) => (
              <div key={i} className="flex shrink-0 flex-col items-center" style={{ width: TICK_W }}>
                <div
                  className={cx(
                    'w-px bg-slate-300 dark:bg-slate-600',
                    i % 10 === 0 ? 'h-6' : i % 5 === 0 ? 'h-4' : 'h-2.5',
                  )}
                />
                {i % 10 === 0 && (
                  <span className="mt-0.5 text-[10px] text-slate-400">
                    {Math.round((min + i * step) * 100) / 100}
                    {unit ?? ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------- 06 长按确认 ---------------------------- */

export function HoldButton({
  label,
  holdingLabel,
  duration = 1200,
  onConfirm,
  tone = 'danger',
  full,
}: {
  label: string
  holdingLabel?: string
  duration?: number
  onConfirm: () => void
  tone?: 'danger' | 'brand'
  full?: boolean
}) {
  const [progress, setProgress] = useState(0)
  const raf = useRef<number>(0)
  const start = useRef<number>(0)
  const done = useRef(false)

  const stop = () => {
    cancelAnimationFrame(raf.current)
    setProgress(0)
    done.current = false
  }

  const tick = (t: number) => {
    if (!start.current) start.current = t
    const p = Math.min(1, (t - start.current) / duration)
    setProgress(p)
    if (p >= 1) {
      if (!done.current) {
        done.current = true
        onConfirm()
      }
      stop()
      return
    }
    raf.current = requestAnimationFrame(tick)
  }

  const begin = () => {
    start.current = 0
    done.current = false
    raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const holding = progress > 0
  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={cx(
        'relative inline-flex min-h-[44px] select-none items-center justify-center gap-2 overflow-hidden rounded-xl border px-4 text-[15px] font-medium transition active:scale-[0.98]',
        full && 'w-full',
        tone === 'danger'
          ? 'border-rose-200 text-rose-600 active:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:active:bg-rose-500/10'
          : 'border-brand-200 text-brand-600 active:bg-brand-50 dark:border-brand-500/40 dark:text-brand-300',
      )}
    >
      {/* 进度底条 */}
      <span
        className={cx(
          'absolute inset-y-0 left-0 transition-none',
          tone === 'danger' ? 'bg-rose-500/15' : 'bg-brand-500/15',
        )}
        style={{ width: `${progress * 100}%` }}
      />
      {/* 波形动画（按住时） */}
      {holding && (
        <span className="relative flex items-end gap-[3px]" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cx('w-[3px] rounded-full animate-wave', tone === 'danger' ? 'bg-rose-500' : 'bg-brand-500')}
              style={{ animationDelay: `${i * 0.12}s`, height: 14 }}
            />
          ))}
        </span>
      )}
      <span className="relative">{holding ? holdingLabel ?? '继续按住…' : label}</span>
    </button>
  )
}
