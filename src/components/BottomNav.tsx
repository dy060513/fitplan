import { cx } from './ui'

export type TabKey = 'plan' | 'train' | 'records' | 'me'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'plan', label: '计划', icon: '📅' },
  { key: 'train', label: '训练', icon: '🏋️' },
  { key: 'records', label: '记录', icon: '📈' },
  { key: 'me', label: '我的', icon: '🙋' },
]

export function BottomNav({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-white/[0.06] dark:bg-[#0c0f14]/85"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4 px-2 py-1.5">
        {TABS.map((t) => {
          const active = value === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className="group flex min-h-[52px] flex-col items-center justify-center gap-0.5"
            >
              <span
                className={cx(
                  'flex h-8 items-center gap-1 rounded-full px-3.5 text-[17px] leading-none transition-all duration-200',
                  active
                    ? 'bg-gradient-to-b from-brand-400 to-brand-500 text-brand-950 shadow-glow-sm'
                    : 'text-slate-400 group-active:scale-90 dark:text-slate-500',
                )}
              >
                <span className={cx('transition-transform duration-200', active && 'scale-105')}>{t.icon}</span>
                {active && <span className="text-[12px] font-semibold">{t.label}</span>}
              </span>
              {!active && <span className="text-[11px] text-slate-400 dark:text-slate-500">{t.label}</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
