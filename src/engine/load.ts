import type { Exercise, Experience, Goal, LoadType, Profile } from '@/types'

/** 经验系数：越有经验，起始负重越接近公式上限 */
const EXPERIENCE_FACTOR: Record<Experience, number> = {
  novice: 0.68,
  beginner: 1.0,
  intermediate: 1.22,
}

/** 性别系数（粗略的相对力量差异，仅用于起始值估算） */
const GENDER_FACTOR: Record<Profile['gender'], number> = {
  male: 1.0,
  female: 0.62,
  other: 0.82,
}

/** 目标系数 */
const GOAL_FACTOR: Record<Goal, number> = {
  muscle: 1.0,
  fatloss: 0.85,
  strength: 1.0,
  toning: 0.85,
  health: 0.78,
}

/** 无负重类动作 */
export function isUnloaded(loadType: LoadType): boolean {
  return loadType === 'bodyweight' || loadType === 'band' || loadType === 'timed' || loadType === 'cardio'
}

/** 按负重类型取整到可用的片重 */
export function roundWeight(loadType: LoadType, kg: number): number {
  if (kg <= 0) return 0
  switch (loadType) {
    case 'barbell':
      return Math.max(5, Math.round(kg / 2.5) * 2.5)
    case 'machine':
      return Math.max(2.5, Math.round(kg / 2.5) * 2.5)
    case 'dumbbell':
      return kg >= 12 ? Math.round(kg) : Math.max(1, Math.round(kg * 2) / 2)
    case 'weighted':
      return Math.max(2, Math.round(kg / 2) * 2)
    default:
      return 0
  }
}

/** 单次递进的最小步长（kg）；无负重类返回 0 */
export function stepFor(loadType: LoadType, kg: number): number {
  switch (loadType) {
    case 'barbell':
      return kg >= 60 ? 5 : 2.5
    case 'machine':
      return 2.5
    case 'dumbbell':
      return kg >= 12 ? 2 : 1
    case 'weighted':
      return kg >= 20 ? 4 : 2
    default:
      return 0
  }
}

/**
 * 起始重量估算（纯函数，不依赖网络）
 * 总负重 = 体重 × loadFactor × 经验 × 性别 × 目标 × 力量修正
 * unilateral（单只/单侧）动作展示重量 = 总负重 / 2
 */
export function estimateStartWeight(
  exercise: Exercise,
  profile: Pick<Profile, 'weightKg' | 'gender' | 'experience' | 'goal'>,
): number {
  if (isUnloaded(exercise.loadType) || exercise.loadFactor <= 0) return 0

  let kg =
    profile.weightKg *
    exercise.loadFactor *
    EXPERIENCE_FACTOR[profile.experience] *
    GENDER_FACTOR[profile.gender] *
    GOAL_FACTOR[profile.goal]

  if (profile.goal === 'strength') kg *= exercise.strengthFactor ?? 1.1
  if (exercise.unilateral) kg = kg / 2

  return roundWeight(exercise.loadType, kg)
}

/** 按百分比调整重量，步长为该类型的最小可用增量，至少变化一个步长 */
export function adjustWeightByPercent(
  loadType: LoadType,
  currentKg: number,
  percent: number,
): number {
  if (currentKg <= 0) return 0
  const step = stepFor(loadType, currentKg)
  if (step === 0) return currentKg
  const raw = currentKg * (1 + percent)
  let next = Math.round(raw / step) * step
  // 保证至少变化一个步长，否则无法形成渐进超负荷
  if (next === currentKg) {
    next = currentKg + (percent > 0 ? step : -step)
  }
  return Math.max(step, Math.round(next * 100) / 100)
}

/** 渐进超负荷的递增百分比：新手幅度大，老手幅度小 */
export function increasePercentFor(experience: Experience): number {
  switch (experience) {
    case 'novice':
      return 0.05
    case 'beginner':
      return 0.04
    case 'intermediate':
      return 0.025
  }
}

/** Epley 公式估算 1RM（用于数据看板展示进步曲线） */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

/* ------------------------------------------------------------------ */
/* 力量水平快速估算（建档向导用）                                          */
/* ------------------------------------------------------------------ */

/**
 * 各动作「1RM / 体重」定级阈值（男性基准）：
 * [beginner 下限, intermediate 下限]，低于 beginner 下限为新手
 */
const STRENGTH_STANDARDS: Record<string, [number, number]> = {
  ex_bb_bench: [0.6, 1.0],
  ex_bb_squat: [0.8, 1.4],
  ex_bb_deadlift: [1.0, 1.6],
  ex_bb_ohp: [0.4, 0.65],
  ex_bb_row: [0.6, 0.9],
}

/** 参与快速定级的动作（建档向导展示用） */
export const STRENGTH_TEST_EXERCISE_IDS = Object.keys(STRENGTH_STANDARDS)

export interface StrengthLiftInput {
  exerciseId: string
  weightKg: number
  reps: number
}

/**
 * 用 1~3 个动作的「重量 × 次数」估算训练经验：
 * Epley 1RM ÷ 体重，对照力量标准定级，多个动作取平均。
 * 无法估算（无有效输入）时返回 null。
 */
export function estimateExperience(
  lifts: StrengthLiftInput[],
  bodyweightKg: number,
  gender: Profile['gender'],
): Experience | null {
  const genderScale = gender === 'female' ? 1 / 0.65 : gender === 'other' ? 1 / 0.85 : 1
  const scores: number[] = []
  for (const lift of lifts) {
    const std = STRENGTH_STANDARDS[lift.exerciseId]
    if (!std || bodyweightKg <= 0) continue
    const orm = epley1RM(lift.weightKg, lift.reps)
    if (orm <= 0) continue
    const ratio = (orm / bodyweightKg) * genderScale
    scores.push(ratio < std[0] ? 0 : ratio < std[1] ? 1 : 2)
  }
  if (!scores.length) return null
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return avg < 0.5 ? 'novice' : avg < 1.5 ? 'beginner' : 'intermediate'
}
