import type {
  Exercise,
  ExerciseProgress,
  MuscleGroup,
  Plan,
  PlanExercise,
  PlanSession,
  PlanWeek,
  Profile,
} from '@/types'
import type { PlanTemplate, TemplateExerciseItem, TemplateStage } from '@/data/templates'
import { buildCooldown, buildWarmup } from './generate'
import { estimateStartWeight, isUnloaded, adjustWeightByPercent, roundWeight } from './load'
import { estimateExerciseMinutes, prescribe } from './prescription'
import { findAlternatives, isAvailableFor, isSafeFor } from './alternatives'
import { hashString, mulberry32, startOfWeekISO, uid } from '@/lib/utils'

/** 强度基准：模板里的 70% = 按体重估算的起始重量 */
const BASE_INTENSITY = 0.7

const STAGE_CN = ['一', '二', '三', '四', '五', '六']

export interface TemplateSubstitution {
  /** 模板原动作 */
  exerciseId: string
  /** 替换后的动作；为空表示因伤病 / 器械缺失被移除 */
  replacementId?: string
  reason: string
}

export interface ExpandTemplateInput {
  template: PlanTemplate
  userId: string
  profile: Profile
  /** 全部动作（含自定义） */
  exercises: Exercise[]
  selectedEquipmentIds: string[]
  /** 每个阶段的周数（= 中周期周数） */
  mesocycleWeeks: number
  progress: Record<string, ExerciseProgress>
  startDateISO: string
}

export interface ExpandTemplateResult {
  plan: Plan
  /** 为跑通模板而自动勾选的器械 */
  addedEquipmentIds: string[]
  substitutions: TemplateSubstitution[]
}

function stagesOf(template: PlanTemplate): TemplateStage[] {
  if (template.stages?.length) return template.stages
  return [
    {
      id: `${template.id}_s1`,
      name: template.name,
      summary: template.summary,
      intensity: BASE_INTENSITY,
      sessions: template.sessions ?? [],
    },
  ]
}

/** 阶段内第几周减负：普通阶段减负末周，冲击期减负倒数第二周（末周留给测试） */
function isDeloadWeekOfStage(stage: TemplateStage, weekInStage: number, weeks: number): boolean {
  if (weeks <= 1) return false
  return stage.isPeak ? weekInStage === weeks - 1 : weekInStage === weeks
}

/**
 * 把模板展开成完整计划。
 * - 多阶段模板：每个阶段展开为一个中周期，总周数 = 阶段数 × 每周数，按日期自动推进阶段
 * - 硬约束：动作器械必须已勾选（模板缺的器械自动补齐），且不触碰伤病禁忌
 */
export function expandTemplate(input: ExpandTemplateInput): ExpandTemplateResult {
  const { template, userId, profile, exercises, selectedEquipmentIds, mesocycleWeeks, progress } = input

  const stages = stagesOf(template)
  const weeksPerStage = Math.max(1, Math.round(mesocycleWeeks))
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const substitutions: TemplateSubstitution[] = []

  // 模板需要的器械自动补齐（用户没勾选的）
  const addedEquipmentIds = template.requiredEquipmentIds.filter((id) => !selectedEquipmentIds.includes(id))
  const available = [...new Set([...selectedEquipmentIds, ...addedEquipmentIds])]

  const startDate = startOfWeekISO(input.startDateISO)
  const planId = uid('plan')
  const baseSeed = [userId, template.id, startDate, profile.goal, profile.experience, available.sort().join(',')].join(
    '|',
  )

  /** 模板动作 → 实际动作（受伤病 / 器械约束时替换或移除） */
  function resolve(item: TemplateExerciseItem, used: Set<string>): Exercise | null {
    const target = byId.get(item.exerciseId)
    if (!target) return null

    const unsafe = !isSafeFor(target, profile.injuries)
    const missing = !isAvailableFor(target, available)
    if (!unsafe && !missing) return target

    const reason = unsafe ? `与你的伤病禁忌冲突（${target.name}）` : `器械未勾选（${target.name}）`
    const replacement =
      findAlternatives(
        target,
        { exercises, selectedEquipmentIds: available, injuries: profile.injuries, excludeIds: [...used] },
        12,
      ).find((e) => !used.has(e.id)) ?? null

    if (replacement) {
      substitutions.push({
        exerciseId: target.id,
        replacementId: replacement.id,
        reason: `${reason}，已替换为「${replacement.name}」`,
      })
      return replacement
    }

    substitutions.push({
      exerciseId: target.id,
      reason: unsafe ? `${reason}，无安全替代动作，已移除` : `${reason}，已移除`,
    })
    return null
  }

  /** 模板动作的处方：组数次数按模板，重量按阶段强度换算 */
  function prescribeItem(ex: Exercise, item: TemplateExerciseItem, intensity: number, deload: boolean) {
    const base = prescribe(ex, profile.goal, profile.experience, { deload })
    const sets = item.sets || base.sets
    const reps = item.reps || base.reps

    let weightKg = 0
    if (!isUnloaded(ex.loadType)) {
      const progressEntry = progress[ex.id]
      const reference =
        progressEntry && progressEntry.currentWeightKg > 0
          ? progressEntry.currentWeightKg
          : estimateStartWeight(ex, profile)
      weightKg = roundWeight(ex.loadType, (reference * intensity) / BASE_INTENSITY)
      if (deload && weightKg > 0) weightKg = adjustWeightByPercent(ex.loadType, weightKg, -0.1)
    }

    return { sets, reps, restSeconds: base.restSeconds, weightKg }
  }

  const weeks: PlanWeek[] = []

  stages.forEach((stage, si) => {
    const stageLabel = `第${STAGE_CN[si] ?? si + 1}阶段 · ${stage.name}`

    for (let w = 1; w <= weeksPerStage; w++) {
      const weekNumber = si * weeksPerStage + w
      const deload = isDeloadWeekOfStage(stage, w, weeksPerStage)
      const weekId = uid('week')
      const seed = hashString(`${baseSeed}|${weekNumber}`)
      const rand = mulberry32(seed)

      const sessions: PlanSession[] = stage.sessions.map((ts, index) => {
        const used = new Set<string>()
        const planExercises: PlanExercise[] = []
        const picked: Exercise[] = []

        for (const item of ts.exercises) {
          const ex = resolve(item, used)
          if (!ex) continue
          used.add(ex.id)
          const rx = prescribeItem(ex, item, stage.intensity, deload)
          planExercises.push({
            id: uid('pex'),
            exerciseId: ex.id,
            kind: 'main',
            order: planExercises.length,
            sets: rx.sets,
            reps: rx.reps,
            restSeconds: rx.restSeconds,
            suggestedWeightKg: rx.weightKg,
            cues: ex.cues,
            reason: item.note
              ? `${item.note}｜${Math.round(stage.intensity * 100)}% 强度${rx.weightKg > 0 ? ` · 起始 ${rx.weightKg}kg` : ''}`
              : `模板处方 ${Math.round(stage.intensity * 100)}% 强度${rx.weightKg > 0 ? ` · 起始 ${rx.weightKg}kg` : ''}`,
          })
          picked.push(ex)
        }

        const groups: MuscleGroup[] = [...new Set(picked.map((e) => e.muscleGroup))]
        const warmup = buildWarmup(profile.sessionMinutes, rand())
        const cooldown = buildCooldown(groups, profile.sessionMinutes, available)
        const warmupMinutes = warmup.reduce((s, i) => s + i.minutes, 0)
        const cooldownMinutes = Math.round(cooldown.reduce((s, i) => s + i.seconds, 0) / 60)
        const estimated =
          warmupMinutes +
          planExercises.reduce(
            (s, pe) =>
              s + estimateExerciseMinutes({ sets: pe.sets, reps: pe.reps, restSeconds: pe.restSeconds }, picked[pe.order]),
            0,
          ) +
          cooldownMinutes

        return {
          id: uid('pses'),
          weekId,
          index,
          weekday: ts.weekday,
          title: ts.title,
          focus: 'weakpoint' as PlanSession['focus'],
          estimatedMinutes: Math.round(estimated),
          warmup,
          exercises: planExercises,
          cooldown,
          status: 'planned' as const,
        }
      })

      sessions.sort((a, b) => a.weekday - b.weekday)
      weeks.push({ id: weekId, planId, weekNumber, isDeload: deload, stageLabel, sessions })
    }
  })

  const plan: Plan = {
    id: planId,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    splitName: template.name,
    mesocycleWeeks: weeks.length,
    startDate,
    status: 'active',
    weeks,
    sourceTemplateId: template.id,
    sourceTemplateName: template.name,
  }

  return { plan, addedEquipmentIds, substitutions }
}
