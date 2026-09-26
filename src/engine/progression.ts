import type {
  Adjustment,
  Exercise,
  ExerciseProgress,
  ExerciseRecord,
  Feedback,
  PainReport,
  Plan,
  Profile,
  WorkoutSet,
} from '@/types'
import { adjustWeightByPercent, increasePercentFor, isUnloaded } from './load'
import { prescribeExercise, sessionDate } from './generate'
import { findSafeReplacement } from './alternatives'
import { addDaysISO, clamp, uid } from '@/lib/utils'

export interface PerformaceSummary {
  exerciseId: string
  /** 本次使用的最高重量 */
  weightKg: number
  /** 本次各组的平均次数 */
  reps: number
  /** 是否完成全部目标次数 */
  completedAll: boolean
  /** 完成的组数 / 目标组数 */
  doneSets: number
  targetSets: number
}

/** 汇总一次训练中某动作的实际完成情况 */
export function summarizeSets(sets: WorkoutSet[]): PerformaceSummary | null {
  const main = sets.filter((s) => s.done || s.reps > 0)
  const list = main.length ? main : sets
  if (!list.length) return null
  const weightKg = Math.max(...list.map((s) => s.weightKg))
  const reps = Math.round(list.reduce((s, x) => s + x.reps, 0) / list.length)
  const doneSets = list.filter((s) => s.done).length
  const targetSets = sets.length
  const completedAll = doneSets === targetSets && list.every((s) => s.reps >= s.targetReps)
  return {
    exerciseId: list[0].exerciseId,
    weightKg,
    reps,
    completedAll,
    doneSets,
    targetSets,
  }
}

/**
 * 渐进超负荷核心规则（纯函数）
 *
 * - 连续两次 RPE ≤ 7 且完成全部目标次数 → 重量 +2.5%~5%（自重/计时类改为次数或时长 +1~2）
 * - RPE ≥ 9 或未完成目标次数 → 维持 或 重量下调 5%~10%
 * - 反馈出现关节疼痛且该动作涉及该部位 → 立即停用并换替代动作
 */
export function computeAdjustment(params: {
  exercise: Exercise
  profile: Profile
  latest: ExerciseRecord
  previous?: ExerciseRecord
  progress?: ExerciseProgress
  pain?: PainReport | null
  date: string
}): { adjustment: Adjustment; nextWeightKg: number; nextReps: number; restUntil?: string } {
  const { exercise, profile, latest, previous, progress, pain, date } = params

  const fromWeightKg = progress?.currentWeightKg ?? latest.weightKg
  const fromReps = progress?.currentReps ?? latest.reps

  const rest = (reason: string) => ({
    adjustment: {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      fromWeightKg,
      toWeightKg: fromWeightKg > 0 ? adjustWeightByPercent(exercise.loadType, fromWeightKg, -0.1) : 0,
      fromReps,
      toReps: fromReps,
      action: 'rest' as const,
      reason,
    },
    nextWeightKg: fromWeightKg > 0 ? adjustWeightByPercent(exercise.loadType, fromWeightKg, -0.1) : 0,
    nextReps: fromReps,
    restUntil: addDaysISO(date, 7),
  })

  // 1) 疼痛优先：涉及疼痛部位的动作立即停用
  if (pain) {
    const hitsPain = exercise.riskRegions.includes(pain.region) || pain.level >= 3
    if (hitsPain) {
      return rest(`反馈出现${pain.level >= 2 ? '明显' : ''}疼痛，建议停止该动作并休息 7 天`)
    }
  }

  const canLoad = !isUnloaded(exercise.loadType) && fromWeightKg > 0
  const easyNow = latest.rpe <= 7 && latest.completedAll
  const easyPrev = !!previous && previous.rpe <= 7 && previous.completedAll

  // 2) 连续两次轻松且完成 → 上调；若本次非常轻松（RPE ≤ 4）则单次即可上调
  const veryEasy = latest.rpe <= 4 && latest.completedAll
  if (easyNow && (easyPrev || veryEasy)) {
    if (canLoad) {
      const percent = increasePercentFor(profile.experience)
      const next = adjustWeightByPercent(exercise.loadType, fromWeightKg, percent)
      return {
        adjustment: {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          fromWeightKg,
          toWeightKg: next,
          fromReps,
          toReps: fromReps,
          action: 'increase',
          reason: easyPrev
            ? `连续两次 RPE ≤ 7 且完成全部次数，重量上调约 ${Math.round(percent * 1000) / 10}%`
            : `本次 RPE ${latest.rpe} 偏低且完成全部次数，重量上调约 ${Math.round(percent * 1000) / 10}%`,
        },
        nextWeightKg: next,
        nextReps: fromReps,
      }
    }
    // 自重 / 计时 / 有氧：改为次数或时长递进
    const repsStep = profile.experience === 'novice' ? 2 : 1
    const step =
      exercise.loadType === 'timed' ? 5 : exercise.loadType === 'cardio' ? 2 : repsStep
    const nextReps = clamp(fromReps + step, 1, exercise.loadType === 'cardio' ? 60 : 60)
    return {
      adjustment: {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        fromWeightKg: 0,
        toWeightKg: 0,
        fromReps,
        toReps: nextReps,
        action: 'increase',
        reason: `连续两次 RPE ≤ 7，${exercise.loadType === 'cardio' ? '时长' : exercise.loadType === 'timed' ? '支撑时长' : '次数'} +${step}`,
      },
      nextWeightKg: 0,
      nextReps,
    }
  }

  // 3) RPE ≥ 9 或未完成目标次数
  if (latest.rpe >= 9 || !latest.completedAll) {
    const hardAndFailed = latest.rpe >= 9 && !latest.completedAll
    if (!canLoad) {
      const nextReps = Math.max(1, fromReps - (hardAndFailed ? 2 : 1))
      return {
        adjustment: {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          fromWeightKg: 0,
          toWeightKg: 0,
          fromReps,
          toReps: nextReps,
          action: 'decrease',
          reason: hardAndFailed ? 'RPE 过高且未完成目标次数，先降低次数' : '强度偏高，适当降低次数',
        },
        nextWeightKg: 0,
        nextReps,
      }
    }
    if (latest.rpe >= 9 && latest.completedAll) {
      // 完成了但非常吃力 → 维持
      return {
        adjustment: {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          fromWeightKg,
          toWeightKg: fromWeightKg,
          fromReps,
          toReps: fromReps,
          action: 'maintain',
          reason: 'RPE ≥ 9 但已完成全部次数，维持当前重量巩固',
        },
        nextWeightKg: fromWeightKg,
        nextReps: fromReps,
      }
    }
    const percent = hardAndFailed || latest.rpe >= 10 ? -0.1 : -0.05
    const next = adjustWeightByPercent(exercise.loadType, fromWeightKg, percent)
    return {
      adjustment: {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        fromWeightKg,
        toWeightKg: next,
        fromReps,
        toReps: fromReps,
        action: 'decrease',
        reason:
          latest.rpe >= 10
            ? 'RPE 达到 10，重量下调 10%'
            : hardAndFailed
              ? 'RPE ≥ 9 且未完成目标次数，重量下调 10%'
              : '未完成目标次数，重量下调 5%',
      },
      nextWeightKg: next,
      nextReps: fromReps,
    }
  }

  // 4) 其余情况维持
  return {
    adjustment: {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      fromWeightKg,
      toWeightKg: fromWeightKg,
      fromReps,
      toReps: fromReps,
      action: 'maintain',
      reason: '强度适中，维持当前处方',
    },
    nextWeightKg: fromWeightKg,
    nextReps: fromReps,
  }
}

export interface ApplyFeedbackInput {
  plan: Plan
  profile: Profile
  exercisesById: Record<string, Exercise>
  allExercises: Exercise[]
  selectedEquipmentIds: string[]
  progress: Record<string, ExerciseProgress>
  session: { id: string; date: string; sets: WorkoutSet[] }
  feedback: Omit<Feedback, 'adjustments' | 'advice' | 'id' | 'createdAt' | 'sessionId'>
}

export interface ApplyFeedbackResult {
  adjustments: Adjustment[]
  advice: string[]
  progress: Record<string, ExerciseProgress>
  plan: Plan
}

/** 提交反馈：更新动作进度 + 自动调整后续计划 */
export function applyFeedback(input: ApplyFeedbackInput): ApplyFeedbackResult {
  const { plan, profile, exercisesById, allExercises, selectedEquipmentIds, session, feedback } = input
  const progress: Record<string, ExerciseProgress> = { ...input.progress }
  const adjustments: Adjustment[] = []
  const advice: string[] = []

  // 按动作分组
  const byExercise = new Map<string, WorkoutSet[]>()
  for (const set of session.sets) {
    const list = byExercise.get(set.exerciseId) ?? []
    list.push(set)
    byExercise.set(set.exerciseId, list)
  }

  for (const [exerciseId, sets] of byExercise) {
    const exercise = exercisesById[exerciseId]
    if (!exercise) continue
    const summary = summarizeSets(sets)
    if (!summary) continue

    const entry = progress[exerciseId]
    const previous = entry?.history[entry.history.length - 1]

    const record: ExerciseRecord = {
      date: session.date,
      sessionId: session.id,
      weightKg: summary.weightKg,
      reps: summary.reps,
      rpe: feedback.rpe,
      completedAll: summary.completedAll,
    }

    const result = computeAdjustment({
      exercise,
      profile,
      latest: record,
      previous,
      progress: entry,
      pain: feedback.pain ?? null,
      date: session.date,
    })

    const easyStreak = record.rpe <= 7 && record.completedAll ? (entry?.easyStreak ?? 0) + 1 : 0

    progress[exerciseId] = {
      exerciseId,
      history: [...(entry?.history ?? []), record].slice(-40),
      currentWeightKg: result.nextWeightKg,
      currentReps: result.nextReps,
      easyStreak,
      restUntil: result.restUntil ?? entry?.restUntil,
      updatedAt: new Date().toISOString(),
    }

    adjustments.push(result.adjustment)
  }

  // 疼痛提示
  if (feedback.pain) {
    advice.push(
      `反馈提到「${feedback.pain.region === 'lowerBack' ? '腰' : feedback.pain.region}」部位疼痛（程度 ${feedback.pain.level}），请立即停止相关动作；如疼痛持续或加重，请及时就医。`,
    )
  }
  if (feedback.rpe >= 9) {
    advice.push('本次整体难度偏高（RPE ≥ 9），下次训练前请确保睡眠与饮食恢复充足。')
  }
  if (feedback.rpe <= 4) {
    advice.push('本次强度偏低（RPE ≤ 4），后续会适当加重；如长期偏轻松可在「我的」中提高训练经验等级。')
  }
  if (!advice.length) {
    advice.push('状态良好，已按规则更新下次训练处方。')
  }

  // 重新处方后续训练
  const nextPlan = represcribeFutureSessions({
    plan,
    profile,
    exercisesById,
    allExercises,
    selectedEquipmentIds,
    progress,
    fromDate: session.date,
  })

  return { adjustments, advice, progress, plan: nextPlan }
}

/** 重新处方：对指定日期之后的未完训次，套用最新进度 / 替换需停用动作 */
export function represcribeFutureSessions(params: {
  plan: Plan
  profile: Profile
  exercisesById: Record<string, Exercise>
  allExercises: Exercise[]
  selectedEquipmentIds: string[]
  progress: Record<string, ExerciseProgress>
  fromDate: string
}): Plan {
  const { plan, profile, exercisesById, allExercises, selectedEquipmentIds, progress, fromDate } = params

  const weeks = plan.weeks.map((week) => {
    const sessions = week.sessions.map((s) => {
      const date = sessionDate(plan, week.weekNumber, s.weekday)
      if (date <= fromDate || s.status === 'done') return s

      const usedInSession = new Set<string>()
      const exercises = s.exercises.map((pe) => {
        const current = exercisesById[pe.exerciseId]
        if (!current) return pe
        const entry = progress[pe.exerciseId]
        const shouldRest = entry?.restUntil ? date < entry.restUntil : false

        if (shouldRest) {
          const replacement = findSafeReplacement(current, {
            exercises: allExercises,
            selectedEquipmentIds,
            injuries: profile.injuries,
            excludeIds: [...usedInSession, pe.exerciseId],
          })
          if (replacement) {
            usedInSession.add(replacement.id)
            const rx = prescribeExercise(replacement, profile, progress[replacement.id], {
              deload: week.isDeload,
            })
            return {
              ...pe,
              exerciseId: replacement.id,
              cues: replacement.cues,
              sets: rx.sets,
              reps: rx.reps,
              restSeconds: rx.restSeconds,
              suggestedWeightKg: rx.weightKg,
              reason: `原动作需暂停，已替换为同肌群替代动作「${replacement.name}」`,
            }
          }
          return { ...pe, reason: '原动作需暂停，本次已降低重量执行' }
        }

        usedInSession.add(pe.exerciseId)
        const rx = prescribeExercise(current, profile, entry, { deload: week.isDeload })
        return {
          ...pe,
          sets: rx.sets,
          reps: rx.reps,
          restSeconds: rx.restSeconds,
          suggestedWeightKg: rx.weightKg,
          reason: entry ? '根据上次训练反馈自动调整' : pe.reason,
        }
      })
      return { ...s, exercises }
    })
    return { ...week, sessions }
  })

  return { ...plan, weeks, updatedAt: new Date().toISOString() }
}

/** 为反馈对象补全 id / 时间戳 */
export function buildFeedback(
  sessionId: string,
  data: Omit<Feedback, 'id' | 'createdAt' | 'sessionId' | 'adjustments' | 'advice'>,
  adjustments: Adjustment[],
  advice: string[],
): Feedback {
  return {
    id: uid('fb'),
    sessionId,
    createdAt: new Date().toISOString(),
    ...data,
    adjustments,
    advice,
  }
}
