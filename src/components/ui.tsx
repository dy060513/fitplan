import { useEffect, type ReactNode } from 'react'

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/* ------------------------------- Card ------------------------------- */

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
        'dark:border-slate-800 dark:bg-slate-900',
        onClick && 'active:scale-[0.995] transition',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-2">
      <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{children}</h2>
      {extra}
    </div>
  )
}

/* ------------------------------ Button ------------------------------ */

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  full?: boolean
  className?: string
  type?: 'button' | 'submit'
}

const VARIANTS: Record<string, string> = {
  primary: 'bg-brand-600 text-white active:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-700',
  secondary:
    'bg-slate-100 text-slate-800 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:active:bg-slate-700',
  ghost:
    'bg-transparent text-brand-600 border border-brand-200 active:bg-brand-50 dark:text-brand-300 dark:border-slate-700 dark:active:bg-slate-800',
  danger: 'bg-rose-600 text-white active:bg-rose-700',
}

const SIZES: Record<string, string> = {
  sm: 'min-h-[36px] px-3 text-[13px]',
  md: 'min-h-[44px] px-4 text-[15px]',
  lg: 'min-h-[52px] px-5 text-[16px]',
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  full,
  className,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-1 rounded-xl font-medium transition select-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------- Chip ------------------------------- */

export function Chip({
  children,
  active,
  onClick,
  size = 'md',
  className,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center rounded-full border font-medium transition select-none',
        size === 'sm' ? 'min-h-[32px] px-3 text-[12px]' : 'min-h-[40px] px-3.5 text-[14px]',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
          : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Tag({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'brand' | 'warn' | 'ok' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  }
  return (
    <span className={cx('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium', tones[tone])}>
      {children}
    </span>
  )
}

/* ------------------------------ Inputs ------------------------------ */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[12px] leading-5 text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  placeholder,
}: {
  value: number | string
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {suffix && <span className="shrink-0 text-[13px] text-slate-500 dark:text-slate-400">{suffix}</span>}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      type="text"
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  )
}

/* ------------------------------- Modal ------------------------------- */

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean
  title?: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-xl dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 dark:active:bg-slate-800"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------------------- EmptyState ---------------------------- */

export function EmptyState({
  emoji,
  title,
  desc,
  action,
}: {
  emoji: string
  title: string
  desc: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
      <div className="mb-3 text-3xl">{emoji}</div>
      <p className="mb-1 text-[15px] font-medium text-slate-800 dark:text-slate-200">{title}</p>
      <p className="mb-4 text-[13px] leading-6 text-slate-500 dark:text-slate-400">{desc}</p>
      {action}
    </div>
  )
}

/* --------------------------- DisclaimerBar --------------------------- */

export function DisclaimerBar({ className }: { className?: string }) {
  return (
    <p
      className={cx(
        'rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
        className,
      )}
    >
      本应用建议不构成医疗建议。如有伤病、慢性病或孕期情况，请先咨询医生。
    </p>
  )
}
