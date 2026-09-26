import { useMemo, useState } from 'react'
import type { Exercise, WorkoutSession } from '@/types'
import { useApp } from '@/store/AppContext'
import { Card, EmptyState, SectionTitle, Tag } from '@/components/ui'
import { Bars, LineChart, Ring } from '@/components/charts/LineChart'
import { epley1RM } from '@/engine/load'
import { formatShortDate, startOfWeekISO, todayISO } from '@/lib/utils'

export function RecordsPage() {
  const { state } = useApp()
  const { sessions, profile, plan, exercises } = state
  const [exerciseId, setExerciseId] = useState<string>('')

  const completed = useMemo(
    () => sessions.filter((s) => s.status === 'completed').sort((a, b) => a.date.localeCompare(b.date)),
    [sessions],
  )

  const totalMinutes = completed.reduce((s, x) => s + (x.durationMinutes ?? 0), 0)

  // 本周完成率
  const weekStart = startOfWeekISO(todayISO())
  const plannedThisWeek = useMemo(() => {
    if (!plan) return 0
    return plan.weeks.reduce((sum, w) => {
      return (
        sum +
        w.sessions.filter((s) => {
          const [y, m, d] = plan.startDate.split('-').map(Number)
          const dt = new Date(y, m - 1, d)
          dt.setDate(dt.getDate() + (w.weekNumber - 1) * 7 + s.weekday)
          const iso = `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, '0')}-${`${dt.getDate()}`.padStart(2, '0')}`
          return iso >= weekStart
        }).length
      )
    }, 0)
  }, [plan, weekStart])

  const doneThisWeek = completed.filter((s) => s.date >= weekStart).length
  const rate = plannedThisWeek ? Math.min(1, doneThisWeek / plannedThisWeek) : 0

  // 体重趋势
  const weightPoints = useMemo(
    () =>
      (profile?.weightLogs ?? [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((w) => ({ label: formatShortDate(w.date), value: w.kg })),
    [profile],
  )

  // 最近 8 周训练次数
  const weeklyBars = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of completed) {
      const key = startOfWeekISO(s.date)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    const keys = [...map.keys()].sort().slice(-8)
    return keys.map((k) => ({ label: formatShortDate(k), value: map.get(k) ?? 0 }))
  }, [completed])

  // 有训练历史的动作
  const exerciseOptions = useMemo(() => {
    const counter = new Map<string, number>()
    for (const s of completed) {
      for (const set of s.sets) {
        counter.set(set.exerciseId, (counter.get(set.exerciseId) ?? 0) + 1)
      }
    }
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => exercises.find((e) => e.id === id))
      .filter(Boolean) as Exercise[]
  }, [completed, exercises])

  const selectedId = exerciseId || exerciseOptions[0]?.id || ''
  const selected = exercises.find((e) => e.id === selectedId)

  const historyPoints = useMemo(() => buildHistory(completed, selectedId), [completed, selectedId])

  if (!completed.length) {
    return (
      <EmptyState
        emoji="📈"
        title="还没有训练记录"
        desc="完成一次训练并提交反馈后，这里会显示体重趋势、完成率与各动作的重量进步曲线。"
      />
    )
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatCard label="累计训练" value={String(completed.length)} unit="次" />
        <StatCard label="累计时长" value={String(Math.round(totalMinutes))} unit="分钟" />
        <StatCard label="平均时长" value={String(Math.round(totalMinutes / completed.length))} unit="分钟" />
      </div>

      <Card className="mb-4">
        <SectionTitle>本周完成率</SectionTitle>
        <Ring
          percent={rate}
          label={`本周已完成 ${doneThisWeek} 次`}
          sub={plannedThisWeek ? `计划 ${plannedThisWeek} 次` : '暂无计划安排'}
        />
      </Card>

      {weeklyBars.length > 0 && (
        <Card className="mb-4">
          <SectionTitle>近 8 周训练次数</SectionTitle>
          <Bars data={weeklyBars} />
        </Card>
      )}

      <Card className="mb-4">
        <SectionTitle>体重趋势</SectionTitle>
        {weightPoints.length >= 2 ? (
          <LineChart points={weightPoints} unit="kg" color="#f59e0b" decimals={1} />
        ) : (
          <p className="py-6 text-center text-[12px] text-slate-400">至少记录 2 次体重才会显示趋势</p>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle
          extra={selected ? <Tag>{selected.name}</Tag> : undefined}
        >
          动作重量曲线
        </SectionTitle>

        {exerciseOptions.length > 1 && (
          <select
            value={selectedId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="mb-3 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] dark:border-slate-700 dark:bg-slate-900"
          >
            {exerciseOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}

        {historyPoints.length >= 2 ? (
          <>
            <LineChart points={historyPoints} unit="kg" color="#338bff" />
            <p className="mt-2 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
              曲线为该动作每次训练使用的最高重量
              {selected && !['bodyweight', 'band', 'timed', 'cardio'].includes(selected.loadType) && (
                <> · 估算 1RM {epley1RM(historyPoints[historyPoints.length - 1].value, selected.level === 'novice' ? 10 : 8)} kg</>
              )}
            </p>
          </>
        ) : (
          <p className="py-6 text-center text-[12px] text-slate-400">该动作还需至少 2 次训练记录</p>
        )}
      </Card>

      <Card>
        <SectionTitle>最近训练</SectionTitle>
        <div className="space-y-2">
          {completed
            .slice(-6)
            .reverse()
            .map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
        </div>
      </Card>
    </div>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-0.5 text-[20px] font-bold leading-none">
        {value}
        <span className="ml-0.5 text-[11px] font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  )
}

function SessionRow({ session }: { session: WorkoutSession }) {
  const done = session.sets.filter((s) => s.done).length
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium">{session.title}</p>
        <p className="text-[11px] text-slate-400">
          {formatShortDate(session.date)} · {done}/{session.sets.length} 组
          {session.durationMinutes ? ` · ${session.durationMinutes} 分钟` : ''}
        </p>
      </div>
      {session.feedback && <Tag tone={session.feedback.rpe >= 9 ? 'warn' : 'ok'}>RPE {session.feedback.rpe}</Tag>}
    </div>
  )
}

function buildHistory(sessions: WorkoutSession[], exerciseId: string) {
  const out: { label: string; value: number }[] = []
  for (const s of sessions) {
    const sets = s.sets.filter((x) => x.exerciseId === exerciseId && (x.done || x.reps > 0))
    if (!sets.length) continue
    const best = sets.reduce((max, x) => Math.max(max, x.weightKg), 0)
    if (best <= 0) continue
    out.push({ label: formatShortDate(s.date), value: best })
  }
  return out
}
