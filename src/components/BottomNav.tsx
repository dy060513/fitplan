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
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = value === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={cx(
                'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] transition',
                active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500',
              )}
            >
              <span className={cx('text-[19px] leading-none', active && 'scale-110')}>{t.icon}</span>
              <span className={cx(active && 'font-semibold')}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
