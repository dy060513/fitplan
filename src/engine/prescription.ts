import type { Exercise, ExerciseLevel, Experience, Goal, LoadType, VolumePreference } from '@/types'

export interface Prescription {
  sets: number
  reps: number
  restSeconds: number
}

interface PrescriptionRule {
  compound: Prescription
  isolation: Prescription
}

/** 各目标的组数 / 次数 / 组间休息基准 */
const RULES: Record<Goal, PrescriptionRule> = {
  // 增肌：中等次数，中短间歇
  muscle: { compound: { sets: 3, reps: 10, restSeconds: 90 }, isolation: { sets: 3, reps: 12, restSeconds: 60 } },
  // 减脂：高次数，短间歇
  fatloss: { compound: { sets: 3, reps: 15, restSeconds: 60 }, isolation: { sets: 3, reps: 15, restSeconds: 45 } },
  // 增力：低次数，长间歇
  strength: { compound: { sets: 5, reps: 5, restSeconds: 150 }, isolation: { sets: 3, reps: 8, restSeconds: 75 } },
  // 塑形：中高次数，短间歇
  toning: { compound: { sets: 3, reps: 12, restSeconds: 60 }, isolation: { sets: 3, reps: 15, restSeconds: 45 } },
  // 保持健康：低容量
  health: { compound: { sets: 2, reps: 12, restSeconds: 75 }, isolation: { sets: 2, reps: 12, restSeconds: 60 } },
}

/** 经验对容量的修正 */
function scaleByExperience(base: Prescription, experience: Experience, level: ExerciseLevel): Prescription {
  let sets = base.sets
  if (experience === 'novice') sets = Math.max(2, sets - 1)
  if (experience === 'intermediate' && level !== 'novice') sets = Math.min(6, sets + 1)
  return { ...base, sets }
}

/** 计时 / 有氧类动作的处方 */
function timedPrescription(exercise: Exercise): Prescription {
  if (exercise.loadType === 'cardio') {
    return { sets: 1, reps: exercise.cardioMinutes ?? 10, restSeconds: 0 }
  }
  if (exercise.loadType === 'timed') {
    return { sets: 3, reps: exercise.durationSeconds ?? 30, restSeconds: 30 }
  }
  return { sets: 3, reps: 12, restSeconds: 45 }
}

export function needsNoWeight(loadType: LoadType): boolean {
  return loadType === 'bodyweight' || loadType === 'band' || loadType === 'timed' || loadType === 'cardio'
}

export interface PrescribeOptions {
  deload?: boolean
  /** 用户自定义容量：组数 / 每组次数。计时与有氧类动作不适用（它们的"次数"是秒 / 分钟） */
  volume?: VolumePreference
}

export function prescribe(
  exercise: Exercise,
  goal: Goal,
  experience: Experience,
  opts: PrescribeOptions = {},
): Prescription {
  if (exercise.loadType === 'cardio' || exercise.loadType === 'timed') {
    return timedPrescription(exercise)
  }

  const rule = RULES[goal]
  const base = exercise.compound ? rule.compound : rule.isolation
  let p = scaleByExperience(base, experience, exercise.level)

  // 自重动作次数偏高一些
  if (exercise.loadType === 'bodyweight' && p.reps < 12) p.reps = 12

  // 用户自定义容量优先（新手默认 2 组太少的场景）
  const vol = opts.volume
  if (vol?.setsPerExercise) p = { ...p, sets: clampInt(vol.setsPerExercise, 1, 8) }
  if (vol?.repsPerSet) p = { ...p, reps: clampInt(vol.repsPerSet, 4, 30) }

  // 减负周：主要靠下调重量（上层 -10%）降低压力；
  // 仅高组数方案（≥4 组）才减 1 组，避免单次训练时长明显缩水
  if (opts.deload && p.sets >= 4) {
    p = { ...p, sets: p.sets - 1 }
  }
  return p
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)))
}

/** 估算一个动作占用的时间（分钟） */
export function estimateExerciseMinutes(p: Prescription, exercise: Exercise): number {
  if (exercise.loadType === 'cardio') return p.reps // 有氧按分钟计
  if (exercise.loadType === 'timed') return (p.reps * p.sets + p.restSeconds * (p.sets - 1)) / 60
  const workSeconds = p.reps * 3 + 10 // 每组动作时间
  return (p.sets * workSeconds + p.restSeconds * Math.max(0, p.sets - 1)) / 60
}
