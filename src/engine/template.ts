import type {
  BodyRegion,
  Exercise,
  ExerciseProgress,
  MuscleGroup,
  Plan,
  PlanExercise,
  PlanSession,
  PlanWeek,
  Profile,
} from '@/types'
import type { PlanTemplate, TemplateExercise } from '@/data/templates'
import { buildCooldown, buildWarmup } from './generate'
import { findAlternatives, isSafeFor } from './alternatives'
import { adjustWeightByPercent, estimateStartWeight, isUnloaded, roundWeight } from './load'
import { estimateExerciseMinutes } from './prescription'
import { isDeloadWeek } from './split'
import { hashString, startOfWeekISO, uid } from '@/lib/utils'

/**
 * 把训练模板展开成一份完整 Plan（N 周中周期）
 * ------------------------------------------------------------------
 * 与自动生成计划的区别：
 * - 动作、组数、次数、重量比例完全由模板决定，不走分化与容量推导
 * - 模板需要的器械若未勾选，会自动补进器械库（保证动作可执行）
 * - 仍然遵守伤病禁忌：命中禁忌的动作会被替换成同肌群替代动作
 * - weightPct 以「系统按体重估算的起始重量 ≈ 70% 极限」为基准换算
 * - 减负周只下调重量 10%，组数保持模板原值（模板可关掉减负周）
 */

export interface ExpandInput {
  template: PlanTemplate
  userId: string
  profile: Profile
  exercises: Exercise[]
  selectedEquipmentIds: string[]
  mesocycleWeeks: number
  progress: Record<string, ExerciseProgress>
  startDateISO: string
}

/** 因伤病或器械缺失而被替换掉的条目，供 UI 提示 */
export interface Substitution {
  sessionTitle: string
  fromName: string
  toName: string
  reason: string
}

export interface ExpandResult {
  plan: Plan
  /** 自动补进器械库的器械 id */
  addedEquipmentIds: string[]
  /** 被替换 / 被跳过的条目 */
  substitutions: Substitution[]
}

interface ResolveCtx {
  byId: Record<string, Exercise>
  /** 全部动作，用于兜底找同肌群替代 */
  all: Exercise[]
  injuries: BodyRegion[]
  /** 展开过程中动态扩充的可用器械集合 */
  equipment: Set<string>
  added: Set<string>
}

/**
 * 解析一个模板动作：
 * 1. 补齐缺失器械（模板动作必须可执行）
 * 2. 命中伤病禁忌时，从替代动作里挑一个安全的
 * 返回 null 表示实在找不到可用动作，只能跳过
 */
function resolveExercise(
  item: TemplateExercise,
  ctx: ResolveCtx,
): { exercise: Exercise; note?: string } | null {
  const original = ctx.byId[item.exerciseId]
  if (!original) return null

  const ensure = (ex: Exercise) => {
    if (!ctx.equipment.has(ex.equipmentId)) {
      ctx.equipment.add(ex.equipmentId)
      ctx.added.add(ex.equipmentId)
    }
  }

  ensure(original)
  if (isSafeFor(original, ctx.injuries)) return { exercise: original }

  // 先找「器械已可用」的安全替代，找不到再放宽到需要补器械的替代
  const alts = (original.alternatives ?? [])
    .map((id) => ctx.byId[id])
    .filter((ex): ex is Exercise => !!ex)
    .filter((ex) => isSafeFor(ex, ctx.injuries))
  const pick =
    alts.find((ex) => ctx.equipment.has(ex.equipmentId)) ??
    alts[0] ??
    // 兜底：在全动作库里找同肌群、安全的替代（器械可自动补齐）
    findAlternatives(
      original,
      {
        exercises: ctx.all,
        selectedEquipmentIds: [...new Set(ctx.all.map((e) => e.equipmentId))],
        injuries: ctx.injuries,
        excludeIds: [original.id],
      },
      1,
    )[0] ??
    null
  ensure(pick)
  return {
    exercise: pick,
    note: `原动作「${original.name}」涉及你的禁忌部位，已替换为「${pick.name}」`,
  }
}

/** 薄肌式组间歇：大重量长休，高次数短休 */
function restFor(item: TemplateExercise, ex: Exercise): number {
  if (ex.loadType === 'cardio') return 0
  if (item.reps <= 5) return 180
  if (item.reps <= 8) return 120
  if (item.reps >= 15) return Math.max(45, Math.round(ex.restSeconds * 0.75))
  return ex.restSeconds
}

export function expandTemplate(input: ExpandInput): ExpandResult {
  const { template, userId, profile, exercises, mesocycleWeeks, progress, startDateISO } = input

  const byId: Record<string, Exercise> = Object.fromEntries(exercises.map((e) => [e.id, e]))
  const ctx: ResolveCtx = {
    byId,
    all: exercises,
    injuries: profile.injuries ?? [],
    equipment: new Set(input.selectedEquipmentIds),
    added: new Set<string>(),
  }

  // 先解析一次，确定最终器械集合（模板动作不随周变化）
  const resolved = template.sessions.map((ts) => ({
    session: ts,
    items: ts.exercises
      .map((item) => ({ item, resolved: resolveExercise(item, ctx) }))
      .filter((x): x is { item: TemplateExercise; resolved: { exercise: Exercise; note?: string } } =>
        Boolean(x.resolved),
      ),
  }))

  const substitutions: Substitution[] = []
  for (const s of resolved) {
    for (const { item, resolved: r } of s.items) {
      const original = byId[item.exerciseId]
      if (!original || r.exercise.id === original.id) continue
      substitutions.push({
        sessionTitle: s.session.title,
        fromName: original.name,
        toName: r.exercise.name,
        reason: '涉及禁忌部位，已自动替换',
      })
    }
  }

  const startDate = startOfWeekISO(startDateISO)
  const planId = uid('plan')
  const seedBase = hashString(`${template.id}|${userId}|${startDate}`)
  const useDeload = template.deload !== false

  const weeks: PlanWeek[] = []

  for (let w = 1; w <= mesocycleWeeks; w++) {
    const deload = useDeload && isDeloadWeek(w, mesocycleWeeks)
    const weekId = uid('week')

    const sessions: PlanSession[] = resolved.map((s, index) => {
      const seed = hashString(`${seedBase}|${w}|${index}`)
      const warmup = buildWarmup(template.sessionMinutes, seed)
      const groups = [...new Set(s.items.map((x) => x.resolved.exercise.muscleGroup))] as MuscleGroup[]
      const cooldown = buildCooldown(groups, template.sessionMinutes, [...ctx.equipment])

      const planExercises: PlanExercise[] = s.items.map(({ item, resolved: r }, i) => {
        const ex = r.exercise
        let weightKg = 0
        if (!isUnloaded(ex.loadType)) {
          const p = progress[ex.id]
          const base =
            p && p.currentWeightKg > 0 ? p.currentWeightKg : estimateStartWeight(ex, profile)
          // 模板给定百分比时，以系统估算的起始重量（≈70% 极限）为基准等比换算
          weightKg = roundWeight(ex.loadType, base * (item.weightPct ? item.weightPct / 70 : 1))
          if (deload) weightKg = adjustWeightByPercent(ex.loadType, weightKg, -0.1)
        }

        const pctText = item.weightPct ? `${item.weightPct}% 极限重量` : null
        const reason =
          r.note ??
          [
            pctText ? `模板 ${item.sets} × ${item.reps} @ ${pctText}` : `模板 ${item.sets} × ${item.reps}`,
            weightKg > 0 ? `起始重量 ${weightKg}kg（按体重估算，可手动修改）` : null,
          ]
              .filter(Boolean)
              .join('，')

        return {
          id: uid('pex'),
          exerciseId: ex.id,
          kind: 'main',
          order: i,
          sets: item.sets,
          reps: item.reps,
          restSeconds: restFor(item, ex),
          suggestedWeightKg: weightKg,
          cues: ex.cues,
          reason,
        }
      })

      const warmupMinutes = warmup.reduce((sum, x) => sum + x.minutes, 0)
      const cooldownMinutes = Math.round(cooldown.reduce((sum, x) => sum + x.seconds, 0) / 60)
      const estimated =
        warmupMinutes +
        planExercises.reduce(
          (sum, pe, i) =>
            sum +
            estimateExerciseMinutes(
              { sets: pe.sets, reps: pe.reps, restSeconds: pe.restSeconds },
              s.items[i].resolved.exercise,
            ),
          0,
        ) +
        cooldownMinutes

      return {
        id: uid('pses'),
        weekId,
        index,
        weekday: s.session.weekday,
        title: s.session.title,
        focus: s.session.focus,
        estimatedMinutes: Math.round(estimated),
        warmup,
        exercises: planExercises,
        cooldown,
        status: 'planned',
      }
    })

    sessions.sort((a, b) => a.weekday - b.weekday)
    weeks.push({ id: weekId, planId, weekNumber: w, isDeload: deload, sessions })
  }

  const plan: Plan = {
    id: planId,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    splitName: template.name,
    mesocycleWeeks,
    startDate,
    status: 'active',
    weeks,
    sourceTemplateId: template.id,
    sourceTemplateName: template.name,
  }

  return { plan, addedEquipmentIds: [...ctx.added], substitutions }
}
