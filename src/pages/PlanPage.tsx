import { useMemo, useState } from 'react'
import type { Exercise, PlanExercise, PlanSession } from '@/types'
import { useApp } from '@/store/AppContext'
import { Button, Card, Chip, EmptyState, Field, Modal, NumberInput, SectionTitle, Tag, cx } from '@/components/ui'
import { MUSCLE_GROUP_LABEL, PATTERN_LABEL, WEEKDAY_LABEL, GOAL_LABEL, EXPERIENCE_SHORT } from '@/lib/labels'
import { formatRest, formatSetsReps, formatTarget, formatWeight } from '@/lib/format'
import { findAlternatives } from '@/engine/alternatives'
import { sessionDate } from '@/engine/generate'
import { needsNoWeight } from '@/engine/prescription'
import { PLAN_TEMPLATES, type PlanTemplate } from '@/data/templates'
import { formatShortDate } from '@/lib/utils'

export function PlanPage({ onGoTrain }: { onGoTrain: () => void }) {
  const { state, dispatch } = useApp()
  const { plan, profile, exercises, selectedEquipmentIds } = state
  const [weekIdx, setWeekIdx] = useState(0)
  const [swap, setSwap] = useState<{ session: PlanSession; pe: PlanExercise } | null>(null)
  const [edit, setEdit] = useState<{ session: PlanSession; pe: PlanExercise } | null>(null)
  const [tplOpen, setTplOpen] = useState(false)

  const exerciseById = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises])

  if (!plan || !profile) {
    return (
      <EmptyState
        emoji="📅"
        title="还没有训练计划"
        desc="完成身体档案与器械选择后，系统会按周生成可执行的训练计划。"
        action={
          <div className="flex w-full flex-col gap-2">
            <Button
              onClick={() => {
                dispatch({ type: 'generatePlan' })
              }}
            >
              自动生成计划
            </Button>
            <Button variant="secondary" onClick={() => setTplOpen(true)}>
              用训练模板
            </Button>
          </div>
        }
      />
    )
  }

  const week = plan.weeks[Math.min(weekIdx, plan.weeks.length - 1)]

  return (
    <div>
      {/* 概览 */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              {plan.sourceTemplateId
                ? `模板计划 · 每周 ${week.sessions.length} 练`
                : `${EXPERIENCE_SHORT[profile.experience]} · ${GOAL_LABEL[profile.goal]} · 每周 ${profile.daysPerWeek} 天`}
            </p>
            <h2 className="mt-0.5 truncate text-[17px] font-semibold">{plan.splitName}</h2>
          </div>
          <Tag tone="brand">{plan.mesocycleWeeks} 周中周期</Tag>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag>单次约 {week.sessions[0]?.estimatedMinutes ?? profile.sessionMinutes} 分钟</Tag>
          <Tag>器械 {selectedEquipmentIds.length} 项</Tag>
          {profile.injuries.length > 0 && <Tag tone="warn">已避开 {profile.injuries.length} 处禁忌部位</Tag>}
        </div>
        {plan.sourceTemplateName && (
          <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-[12px] leading-5 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            来源模板「{plan.sourceTemplateName}」。组数、次数、重量都可以点动作右侧的「改」自行调整。
          </div>
        )}
      </Card>

      {/* 周切换 */}
      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {plan.weeks.map((w, i) => (
          <Chip key={w.id} active={week.weekNumber === w.weekNumber} onClick={() => setWeekIdx(i)} className="shrink-0">
            第 {w.weekNumber} 周{w.isDeload ? ' · 减负' : ''}
          </Chip>
        ))}
      </div>

      {week.isDeload && (
        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          本周为减负周：重量已下调 10%，帮助身体恢复，为下一个中周期做准备。
        </div>
      )}

      <SectionTitle extra={<span className="text-[12px] text-slate-400">共 {week.sessions.length} 次</span>}>
        本周训练安排
      </SectionTitle>

      <div className="space-y-3">
        {week.sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            date={sessionDate(plan, week.weekNumber, s.weekday)}
            exerciseById={exerciseById}
            onStart={() => {
              dispatch({
                type: 'startSession',
                planSessionId: s.id,
                title: s.title,
                focus: PATTERN_LABEL[s.focus],
              })
              onGoTrain()
            }}
            onSwap={(pe) => setSwap({ session: s, pe })}
            onEdit={(pe) => setEdit({ session: s, pe })}
          />
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <Button variant="secondary" full onClick={() => setTplOpen(true)}>
          用训练模板替换计划
        </Button>
        <Button
          variant="ghost"
          full
          onClick={() => {
            if (confirm('重新生成会覆盖当前计划，确定继续？')) dispatch({ type: 'generatePlan' })
          }}
        >
          按我的偏好重新生成
        </Button>
      </div>

      {swap && swap.pe && (
        <SwapModal
          target={exerciseById[swap.pe.exerciseId]}
          onClose={() => setSwap(null)}
          onPick={(ex: Exercise) => {
            dispatch({
              type: 'replacePlanExercise',
              planSessionId: swap.session.id,
              planExerciseId: swap.pe.id,
              exerciseId: ex.id,
            })
            setSwap(null)
          }}
        />
      )}

      {edit && (
        <EditExerciseModal
          sessionId={edit.session.id}
          pe={edit.pe}
          exercise={exerciseById[edit.pe.exerciseId]}
          onClose={() => setEdit(null)}
        />
      )}

      {tplOpen && <TemplateModal onClose={() => setTplOpen(false)} />}
    </div>
  )
}

/* --------------------------- 单次训练卡片 --------------------------- */

function SessionCard({
  session,
  date,
  exerciseById,
  onStart,
  onSwap,
  onEdit,
}: {
  session: PlanSession
  date: string
  exerciseById: Record<string, Exercise>
  onStart: () => void
  onSwap: (pe: PlanExercise) => void
  onEdit: (pe: PlanExercise) => void
}) {
  const [open, setOpen] = useState(false)
  const done = session.status === 'done'

  return (
    <Card className={cx(done && 'opacity-70')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold">{session.title}</span>
            {done && <Tag tone="ok">已完成</Tag>}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">
            {WEEKDAY_LABEL[session.weekday]} · {formatShortDate(date)} · 约 {session.estimatedMinutes} 分钟 ·{' '}
            {session.exercises.length} 个动作
          </p>
        </div>
        <span className={cx('shrink-0 text-slate-400 transition', open && 'rotate-180')}>▾</span>
      </button>

      {open && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Block title="热身（约 5–10 分钟）">
            <ul className="space-y-1">
              {session.warmup.map((w) => (
                <li key={w.id} className="text-[13px] leading-6 text-slate-600 dark:text-slate-300">
                  · {w.name} <span className="text-slate-400">{w.minutes} 分钟</span>
                  {w.note && <div className="pl-2 text-[12px] text-slate-400">{w.note}</div>}
                </li>
              ))}
            </ul>
          </Block>

          <Block title="主体训练">
            <div className="space-y-2.5">
              {session.exercises.map((pe) => {
                const ex = exerciseById[pe.exerciseId]
                return (
                  <div
                    key={pe.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium">{ex?.name ?? '未知动作'}</p>
                        <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                          {ex ? MUSCLE_GROUP_LABEL[ex.muscleGroup] : ''} · {formatSetsReps(ex, pe.sets, pe.reps)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[15px] font-semibold text-brand-600 dark:text-brand-400">
                          {formatWeight(ex, pe.suggestedWeightKg)}
                        </p>
                        <p className="text-[11px] text-slate-400">{formatRest(pe.restSeconds)}</p>
                      </div>
                    </div>
                    {!!ex?.cues.length && (
                      <ul className="mt-2 space-y-1">
                        {ex.cues.map((c, i) => (
                          <li key={i} className="text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                            · {c}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {pe.reason && (
                        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{pe.reason}</span>
                      )}
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(pe)}>
                          改
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onSwap(pe)}>
                          换一个
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Block>

          <Block title="放松拉伸">
            <ul className="space-y-1">
              {session.cooldown.map((c) => (
                <li key={c.id} className="text-[13px] leading-6 text-slate-600 dark:text-slate-300">
                  · {c.name} <span className="text-slate-400">{c.seconds} 秒</span>
                </li>
              ))}
            </ul>
          </Block>

          <Button full size="lg" onClick={onStart} className="mt-3">
            开始这次训练
          </Button>
        </div>
      )}
    </Card>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">{title}</p>
      {children}
    </div>
  )
}

/* --------------------------- 改组数/重量 --------------------------- */

function EditExerciseModal({
  sessionId,
  pe,
  exercise,
  onClose,
}: {
  sessionId: string
  pe: PlanExercise
  exercise: Exercise | undefined
  onClose: () => void
}) {
  const { dispatch } = useApp()
  const [sets, setSets] = useState(pe.sets)
  const [reps, setReps] = useState(pe.reps)
  const [weight, setWeight] = useState(pe.suggestedWeightKg)
  const [rest, setRest] = useState(pe.restSeconds)

  const noWeight = !exercise || needsNoWeight(exercise.loadType)
  const unit = exercise ? formatTarget(exercise, 0).replace('0 ', '') : '次'

  return (
    <Modal
      open
      title={`调整「${exercise?.name ?? '动作'}」`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button
            full
            onClick={() => {
              dispatch({
                type: 'updatePlanExercise',
                planSessionId: sessionId,
                planExerciseId: pe.id,
                patch: {
                  sets: Math.max(1, Math.min(10, Math.round(sets))),
                  reps: Math.max(1, Math.min(600, Math.round(reps))),
                  suggestedWeightKg: noWeight ? 0 : Math.max(0, weight),
                  restSeconds: Math.max(0, Math.min(600, Math.round(rest))),
                },
              })
              onClose()
            }}
          >
            保存
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!confirm('从本次训练中删除这个动作？')) return
              dispatch({ type: 'removePlanExercise', planSessionId: sessionId, planExerciseId: pe.id })
              onClose()
            }}
          >
            删除
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
        改完立即生效，本次及后续训练都会按新数值执行。
      </p>
      <Field label="组数">
        <NumberInput value={sets} onChange={setSets} min={1} max={10} suffix="组" />
      </Field>
      <Field label="每组目标" hint={unit === '次' ? '次数' : `单位：${unit}`}>
        <NumberInput value={reps} onChange={setReps} min={1} max={600} suffix={unit} />
      </Field>
      {!noWeight && (
        <Field label="建议重量" hint="按器械最小刻度取整；单侧器械按「每只」计">
          <NumberInput value={weight} onChange={setWeight} min={0} max={400} step={0.5} suffix="kg" />
        </Field>
      )}
      <Field label="组间休息">
        <NumberInput value={rest} onChange={setRest} min={0} max={600} step={5} suffix="秒" />
      </Field>
      {noWeight && (
        <p className="text-[12px] leading-5 text-slate-400">
          该动作为自重 / 弹力带 / 计时类，不设重量，靠次数与时长递进。
        </p>
      )}
    </Modal>
  )
}

/* ----------------------------- 换动作 ----------------------------- */

function SwapModal({
  target,
  onClose,
  onPick,
}: {
  target: Exercise | undefined
  onClose: () => void
  onPick: (ex: Exercise) => void
}) {
  const { state } = useApp()
  const options = useMemo(() => {
    if (!target) return []
    return findAlternatives(target, {
      exercises: state.exercises,
      selectedEquipmentIds: state.selectedEquipmentIds,
      injuries: state.profile?.injuries ?? [],
    })
  }, [target, state.exercises, state.selectedEquipmentIds, state.profile])

  return (
    <Modal open={!!target} title={`替换「${target?.name ?? ''}」`} onClose={onClose}>
      <p className="mb-3 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
        以下动作来自你已勾选的器械，主肌群与难度相近，可直接替换。
      </p>
      {options.length === 0 && (
        <p className="py-6 text-center text-[13px] text-slate-400">
          暂无合适的替代动作，可在「我的 → 器械」中勾选更多器械。
        </p>
      )}
      <div className="space-y-2">
        {options.map((ex) => {
          const eq = state.equipment.find((e) => e.id === ex.equipmentId)
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => onPick(ex)}
              className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 text-left active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{ex.name}</p>
                <p className="truncate text-[12px] text-slate-400">
                  {MUSCLE_GROUP_LABEL[ex.muscleGroup]} · {eq?.name ?? ''}
                </p>
              </div>
              <span className="shrink-0 text-slate-300">›</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

/* ----------------------------- 模板库 ----------------------------- */

function TemplateModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp()
  const [detail, setDetail] = useState<PlanTemplate | null>(null)

  const exerciseById = useMemo(
    () => Object.fromEntries(state.exercises.map((e) => [e.id, e])),
    [state.exercises],
  )

  const missingEquipment = (t: PlanTemplate) =>
    t.requiredEquipmentIds.filter((id) => !state.selectedEquipmentIds.includes(id))

  const apply = (t: PlanTemplate) => {
    if (state.plan && !confirm(`会用「${t.name}」覆盖当前计划，确定继续？`)) return
    dispatch({ type: 'applyTemplate', templateId: t.id })
    setDetail(null)
    onClose()
  }

  return (
    <Modal open title="训练模板" onClose={onClose}>
      {!detail ? (
        <>
          <p className="mb-3 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
            模板是别人写好的固定处方：动作、组数、次数都按模板来。套用后仍可逐个动作改重量与组数。
          </p>
          <div className="space-y-2.5">
            {PLAN_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetail(t)}
                className="w-full rounded-xl border border-slate-200 p-3 text-left active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold">{t.name}</p>
                  <Tag tone="brand">每周 {t.daysPerWeek} 天</Tag>
                </div>
                <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{t.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.tags.map((x) => (
                    <Tag key={x}>{x}</Tag>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="mb-2 text-[13px] text-brand-600 dark:text-brand-400"
          >
            ‹ 返回模板列表
          </button>
          <p className="text-[16px] font-semibold">{detail.name}</p>
          <p className="mt-1 text-[12px] text-slate-400">{detail.source}</p>
          <p className="mt-2 text-[13px] leading-6 text-slate-600 dark:text-slate-300">{detail.summary}</p>

          <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="mb-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">训练思路</p>
            <ul className="space-y-1">
              {detail.principle.map((p, i) => (
                <li key={i} className="text-[12px] leading-5 text-slate-600 dark:text-slate-300">
                  · {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 space-y-2">
            {detail.sessions.map((s) => (
              <div
                key={s.weekday}
                className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <p className="text-[14px] font-medium">
                  {s.title} <span className="text-[12px] text-slate-400">{WEEKDAY_LABEL[s.weekday]}</span>
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {s.exercises.map((it, i) => {
                    const ex = exerciseById[it.exerciseId]
                    return (
                      <li key={i} className="flex justify-between gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                        <span className="truncate">
                          {ex?.name ?? it.exerciseId}
                          {it.note && <span className="text-slate-400">（{it.note}）</span>}
                        </span>
                        <span className="shrink-0 text-slate-400">
                          {it.sets} × {formatTarget(ex, it.reps)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {missingEquipment(detail).length > 0 && (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                套用会自动勾选以下器械：
                {missingEquipment(detail)
                  .map((id) => state.equipment.find((e) => e.id === id)?.name ?? id)
                  .join('、')}
              </div>
            )}
            {detail.note && <p className="text-[12px] leading-5 text-slate-400">{detail.note}</p>}
            <Button full size="lg" onClick={() => apply(detail)}>
              套用这个模板
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
