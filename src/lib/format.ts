import type { Exercise } from '@/types'

/** 把计划的 reps 字段按动作类型格式化成可读文本 */
export function formatTarget(exercise: Exercise | undefined, reps: number): string {
  if (!exercise) return `${reps} 次`
  switch (exercise.loadType) {
    case 'timed':
      return `${reps} 秒`
    case 'cardio':
      return `${reps} 分钟`
    default:
      return `${reps} 次`
  }
}

/** 组数 × 目标 */
export function formatSetsReps(exercise: Exercise | undefined, sets: number, reps: number): string {
  if (!exercise) return `${sets} 组 × ${reps} 次`
  if (exercise.loadType === 'cardio') return `${reps} 分钟`
  return `${sets} 组 × ${formatTarget(exercise, reps)}`
}

/** 重量展示：自重类返回「自重」 */
export function formatWeight(exercise: Exercise | undefined, kg: number): string {
  if (!exercise) return kg > 0 ? `${kg} kg` : '自重'
  if (exercise.loadType === 'cardio') return '—'
  if (exercise.loadType === 'bodyweight') return '自重'
  if (exercise.loadType === 'band') return '弹力带'
  if (exercise.loadType === 'timed') return '计时'
  if (kg <= 0) return '自重'
  return `${kg} kg${exercise.unilateral ? ' / 只' : ''}`
}

export function formatRest(seconds: number): string {
  if (seconds <= 0) return '不停歇'
  if (seconds < 60) return `休息 ${seconds} 秒`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `休息 ${m} 分` : `休息 ${m} 分 ${s} 秒`
}
