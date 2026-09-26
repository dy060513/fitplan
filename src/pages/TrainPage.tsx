import { useMemo, useState } from 'react'
import type { Exercise, Feedback, WorkoutSession, WorkoutSet } from '@/types'
import { useApp } from '@/store/AppContext'
import { Button, Card, EmptyState, Modal, SectionTitle, Tag, cx } from '@/components/ui'
import { FeedbackForm, type FeedbackDraft } from '@/components/FeedbackForm'
import { RestTimer } from '@/components/RestTimer'
import { MUSCLE_GROUP_LABEL, WEEKDAY_LABEL } from '@/lib/labels'
import { formatSetsReps } from '@/lib/format'
import { sessionDate } from '@/engine/generate'
import { formatShortDate, todayISO, toNumber } from '@/lib/utils'

export function TrainPage({ onGoPlan }: { onGoPlan: () => void }) {
  const { state, dispatch } = useApp()
  const { plan, sessions, exercises, profile } = state
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [restFor, setRestFor] = useState<number | null>(null)

  const exerciseById = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises])

  const active = sessions.find((s) => s.status === 'in-progress') ?? null

  /** 今日（或最近一次）建议执行的计划训练 */
  const suggestion = useMemo(() => {
    if (!plan) return null
    const today = todayISO()
    const flat = plan.weeks.flatMap((w) =>
      w.sessions.map((s) => ({ session: s, week: w, date: sessionDate(plan, w.weekNumber, s.weekday) })),
    )
    const todayItem = flat.find((x) => x.date === today && x.session.status !== 'done')
    if (todayItem) return todayItem
    const next = flat.filter((x) => x.date > today && x.session.status !== 'done').sort((a, b) => a.date.localeCompare(b.date))[0]
    if (next) return next
    return flat.find((x) => x.session.status !== 'done') ?? null
  }, [plan])

  if (active) {
    return (
      <ActiveSession
        session={active}
        exerciseById={exerciseById}
        restFor={restFor}
        setRestFor={setRestFor}
        onOpenFeedback={() => setFeedbackOpen(true)}
        onDiscard={() => {
          if (confirm('放弃本次训练记录？')) dispatch({ type: 'discardSession', sessionId: active.id })
        }}
        onSubmitFeedback={(draft: FeedbackDraft) => {
          const started = new Date(active.startedAt).getTime()
          const minutes = draft.actualMinutes || Math.max(1, Math.round((Date.now() - started) / 60000))
          dispatch({
            type: 'finishSession',
            sessionId: active.id,
            durationMinutes: minutes,
            feedback: {
              rpe: draft.rpe,
              completion: draft.completion,
              fatigueRegions: draft.fatigueRegions,
              pain: draft.pain,
              actualMinutes: minutes,
              note: draft.note,
            },
          })
          setFeedbackOpen(false)
          setResultOpen(true)
        }}
        feedbackOpen={feedbackOpen}
        onCloseFeedback={() => setFeedbackOpen(false)}
        resultOpen={resultOpen}
        onCloseResult={() => setResultOpen(false)}
      />
    )
  }

  const doneCount = sessions.filter((s) => s.status === 'completed').length

  return (
    <div>
      {suggestion ? (
        <Card className="mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                {suggestion.date === todayISO() ? '今日训练' : `计划 · ${formatShortDate(suggestion.date)}`}
              </p>
              <h2 className="mt-0.5 truncate text-[18px] font-semibold">{suggestion.session.title}</h2>
            </div>
            <Tag tone="brand">第 {suggestion.week.weekNumber} 周</Tag>
          </div>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            {WEEKDAY_LABEL[suggestion.session.weekday]} · 约 {suggestion.session.estimatedMinutes} 分钟 ·{' '}
            {suggestion.session.exercises.length} 个动作
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestion.session.exercises.slice(0, 6).map((pe) => (
              <span
                key={pe.id}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {exerciseById[pe.exerciseId]?.name ?? '动作'}
              </span>
            ))}
          </div>
          <Button
            full
            size="lg"
            className="mt-3"
            onClick={() =>
              dispatch({
                type: 'startSession',
                planSessionId: suggestion.session.id,
                title: suggestion.session.title,
              })
            }
          >
            开始训练
          </Button>
        </Card>
      ) : (
        <EmptyState
          emoji="🏋️"
          title="暂无可执行的训练"
          desc="先到「计划」页生成一份周计划，或直接开始一次自由训练。"
          action={<Button onClick={onGoPlan}>去生成计划</Button>}
        />
      )}

      <SectionTitle>其他操作</SectionTitle>
      <div className="space-y-2">
        <Button
          variant="secondary"
          full
          onClick={() =>
            dispatch({
              type: 'startSession',
              title: '自由训练',
            })
          }
        >
          开始一次自由训练（无计划）
        </Button>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          已完成 {doneCount} 次训练
          {profile ? ` · 目标：${profile.sessionMinutes} 分钟 / 次` : ''}
        </div>
      </div>
    </div>
  )
}

function ActiveSession({
  session,
  exerciseById,
  onOpenFeedback,
  onDiscard,
  onSubmitFeedback,
  feedbackOpen,
  onCloseFeedback,
  resultOpen,
  onCloseResult,
  restFor,
  setRestFor,
}: {
  session: WorkoutSession
  exerciseById: Record<string, Exercise>
  onOpenFeedback: () => void
  onDiscard: () => void
  onSubmitFeedback: (draft: FeedbackDraft) => void
  feedbackOpen: boolean
  onCloseFeedback: () => void
  resultOpen: boolean
  onCloseResult: () => void
  restFor: number | null
  setRestFor: (n: number | null) => void
}) {
  const { dispatch } = useApp()
  const totalSets = session.sets.length
  const doneSets = session.sets.filter((s) => s.done).length
  const progress = totalSets ? doneSets / totalSets : 0

  // 按动作分组
  const groups = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>()
    for (const s of session.sets) {
      const list = map.get(s.exerciseId) ?? []
      list.push(s)
      map.set(s.exerciseId, list)
    }
    return [...map.entries()]
  }, [session.sets])

  const elapsed = Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000))

  return (
    <div>
      <Card className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-semibold">{session.title}</h2>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              已完成 {doneSets} / {totalSets} 组 · 已用时约 {elapsed} 分钟
            </p>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            className="shrink-0 rounded-lg px-2 py-1 text-[12px] text-slate-400 active:bg-slate-100 dark:active:bg-slate-800"
          >
            放弃
          </button>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </Card>

      {!session.sets.length && (
        <EmptyState emoji="➕" title="本次训练还没有动作" desc="可在下方结束并提交反馈，或放弃本次记录。" />
      )}

      <div className="space-y-3">
        {groups.map(([exerciseId, sets]) => {
          const ex = exerciseById[exerciseId]
          return (
            <Card key={exerciseId}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold leading-tight">{ex?.name ?? '动作'}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                    {ex ? MUSCLE_GROUP_LABEL[ex.muscleGroup] : ''} · 目标 {formatSetsReps(ex, sets.length, sets[0]?.targetReps ?? 0)}
                  </p>
                </div>
              </div>

              {!!ex?.cues.length && (
                <p className="mb-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[12px] leading-5 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  {ex.cues[0]}
                </p>
              )}

              <div className="space-y-2">
                {sets.map((set, i) => (
                  <SetRow
                    key={set.id}
                    index={i}
                    set={set}
                    exercise={ex}
                    onChange={(next) => dispatch({ type: 'upsertSet', sessionId: session.id, set: next })}
                    onDone={() => {
                      const next: WorkoutSet = { ...set, done: !set.done }
                      dispatch({ type: 'upsertSet', sessionId: session.id, set: next })
                      if (!set.done && ex && ex.loadType !== 'cardio') setRestFor(ex.restSeconds || 60)
                    }}
                  />
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <Button full size="lg" className="mt-4" onClick={onOpenFeedback}>
        完成训练并提交反馈
      </Button>

      {restFor !== null && <RestTimer seconds={restFor} onDone={() => setRestFor(null)} />}

      <FeedbackForm
        open={feedbackOpen}
        defaultMinutes={elapsed}
        onClose={onCloseFeedback}
        onSubmit={onSubmitFeedback}
      />

      <ResultModal open={resultOpen} onClose={onCloseResult} feedback={session.feedback ?? null} />
    </div>
  )
}

function SetRow({
  index,
  set,
  exercise,
  onChange,
  onDone,
}: {
  index: number
  set: WorkoutSet
  exercise: Exercise | undefined
  onChange: (s: WorkoutSet) => void
  onDone: () => void
}) {
  const showWeight = exercise ? !['bodyweight', 'band', 'timed', 'cardio'].includes(exercise.loadType) : true
  const unit = exercise?.loadType === 'timed' ? '秒' : exercise?.loadType === 'cardio' ? '分钟' : '次'

  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-xl border p-2 transition',
        set.done
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-500/10'
          : 'border-slate-200 dark:border-slate-700',
      )}
    >
      <span className="w-11 shrink-0 text-center text-[13px] font-medium text-slate-500 dark:text-slate-400">
        第{index + 1}组
      </span>

      {showWeight && (
        <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-slate-50 px-2 dark:bg-slate-800/60">
          <input
            type="number"
            inputMode="decimal"
            value={set.weightKg}
            step={0.5}
            onChange={(e) => onChange({ ...set, weightKg: toNumber(e.target.value) })}
            className="min-h-[44px] w-full min-w-0 bg-transparent text-center text-[16px] font-semibold outline-none"
          />
          <span className="shrink-0 text-[11px] text-slate-400">kg</span>
        </label>
      )}

      <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-slate-50 px-2 dark:bg-slate-800/60">
        <input
          type="number"
          inputMode="numeric"
          value={set.reps}
          onChange={(e) => onChange({ ...set, reps: toNumber(e.target.value) })}
          className="min-h-[44px] w-full min-w-0 bg-transparent text-center text-[16px] font-semibold outline-none"
        />
        <span className="shrink-0 text-[11px] text-slate-400">{unit}</span>
      </label>

      <button
        type="button"
        onClick={onDone}
        aria-label={set.done ? '取消完成' : '完成本组'}
        className={cx(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[18px] font-bold transition',
          set.done
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-100 text-slate-400 active:bg-slate-200 dark:bg-slate-800 dark:active:bg-slate-700',
        )}
      >
        ✓
      </button>
    </div>
  )
}

function ResultModal({
  open,
  onClose,
  feedback,
}: {
  open: boolean
  onClose: () => void
  feedback: Feedback | null
}) {
  if (!feedback) return null
  return (
    <Modal open={open} title="本次小结" onClose={onClose} footer={<Button full size="lg" onClick={onClose}>知道了</Button>}>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="RPE" value={String(feedback.rpe)} />
        <Stat label="时长" value={`${feedback.actualMinutes}′`} />
        <Stat label="调整动作" value={String(feedback.adjustments.length)} />
      </div>

      {feedback.advice.length > 0 && (
        <div className="mb-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10">
          {feedback.advice.map((a, i) => (
            <p key={i} className="text-[12px] leading-5 text-amber-700 dark:text-amber-300">
              · {a}
            </p>
          ))}
        </div>
      )}

      <p className="mb-2 text-[13px] font-semibold">下次调整</p>
      <div className="space-y-2">
        {feedback.adjustments.map((a) => (
          <div
            key={a.exerciseId}
            className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[14px] font-medium">{a.exerciseName}</span>
              <Tag
                tone={
                  a.action === 'increase' ? 'ok' : a.action === 'decrease' ? 'warn' : a.action === 'rest' ? 'warn' : 'slate'
                }
              >
                {a.action === 'increase' ? '上调' : a.action === 'decrease' ? '下调' : a.action === 'rest' ? '暂停' : '维持'}
              </Tag>
            </div>
            <p className="mt-1 text-[14px] font-semibold text-brand-600 dark:text-brand-400">
              {a.fromWeightKg > 0 || a.toWeightKg > 0
                ? `${a.fromWeightKg} kg → ${a.toWeightKg} kg`
                : `${a.fromReps} 次 → ${a.toReps} 次`}
            </p>
            <p className="mt-0.5 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{a.reason}</p>
          </div>
        ))}
        {!feedback.adjustments.length && (
          <p className="py-4 text-center text-[13px] text-slate-400">本次没有可调整的动作</p>
        )}
      </div>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2 dark:bg-slate-800/60">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-[18px] font-bold">{value}</p>
    </div>
  )
}
