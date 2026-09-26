import { useEffect, useState } from 'react'
import { Button } from './ui'

/** 组间休息倒计时：勾选一组后自动弹出，可跳过 */
export function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    setLeft(seconds)
  }, [seconds])

  useEffect(() => {
    if (left <= 0) return
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left])

  if (seconds <= 0) return null

  const pct = Math.max(0, Math.min(1, 1 - left / seconds))

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-md px-4">
      <div className="rounded-2xl border border-brand-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-medium">组间休息</span>
          <span className="text-[20px] font-bold tabular-nums text-brand-600 dark:text-brand-400">
            {left > 0 ? `${Math.floor(left / 60)}:${`${left % 60}`.padStart(2, '0')}` : '时间到'}
          </span>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct * 100}%` }} />
        </div>
        <Button size="sm" variant="secondary" full onClick={onDone}>
          跳过休息
        </Button>
      </div>
    </div>
  )
}
