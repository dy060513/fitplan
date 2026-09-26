import type { MuscleGroup, MovementPattern, TrainingRhythm } from '@/types'

export type Focus = MovementPattern | 'full' | 'upper' | 'lower' | 'weakpoint'

export interface SessionSpec {
  index: number
  /** 0 = 周一 */
  weekday: number
  title: string
  focus: Focus
  /** 需要覆盖的肌群，按优先级排列 */
  muscleGroups: MuscleGroup[]
  /** 是否安排有氧 */
  cardio: boolean
  /** 是否安排核心 */
  core: boolean
}

/** 各节奏下训练日的优先顺序（0 = 周一），按优先级取前 N 个 */
const RHYTHM_ORDER: Record<'consecutive' | 'rest1' | 'rest2', number[]> = {
  // 连着练
  consecutive: [0, 1, 2, 3, 4, 5, 6],
  // 练一休一：周一 / 三 / 五 / 日
  rest1: [0, 2, 4, 6, 1, 3, 5],
  // 练二休一：周一二 / 周四周五 / 周日
  rest2: [0, 1, 3, 4, 6, 2, 5],
}

/** 该节奏在不出现相邻连练的前提下，一周最多能排几天 */
export const RHYTHM_MAX_DAYS: Record<TrainingRhythm, number> = {
  consecutive: 6,
  rest1: 4,
  rest2: 5,
  custom: 6,
}

/**
 * 按节奏推导每周训练日（0 = 周一）
 * custom 时直接采用用户勾选的星期；若为空则退回连续排。
 */
export function suggestWeekdays(
  daysPerWeek: number,
  rhythm: TrainingRhythm = 'consecutive',
  customWeekdays: number[] = [],
): number[] {
  if (rhythm === 'custom') {
    const list = [...new Set(customWeekdays)]
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b)
    if (list.length) return list.slice(0, 6)
  }
  const order = rhythm === 'custom' ? RHYTHM_ORDER.consecutive : RHYTHM_ORDER[rhythm] ?? RHYTHM_ORDER.consecutive
  const n = Math.max(1, Math.min(7, Math.round(daysPerWeek)))
  return order.slice(0, n).sort((a, b) => a - b)
}

const WEEKDAY_PLAN: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
}

const PUSH: MuscleGroup[] = ['chest', 'shoulders', 'triceps']
const PULL: MuscleGroup[] = ['back', 'biceps']
const LEGS: MuscleGroup[] = ['quads', 'hamstrings', 'glutes']
const UPPER: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps']
const LOWER: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves']
const FULL: MuscleGroup[] = ['chest', 'back', 'quads', 'shoulders', 'hamstrings']

/**
 * 按每周训练日数量自动选择分化方式
 * 1–2 天 → 全身分化
 * 3 天   → 推 / 拉 / 腿
 * 4 天   → 上肢 / 下肢分化
 * 5–6 天 → 推 / 拉 / 腿 + 专项弱项
 *
 * @param weekdays 由训练节奏推导出的具体星期（0 = 周一）；不传则用内置排期
 */
export function chooseSplit(daysPerWeek: number, weekdays?: number[]): { name: string; sessions: SessionSpec[] } {
  const days = weekdays && weekdays.length ? weekdays : WEEKDAY_PLAN[daysPerWeek] ?? WEEKDAY_PLAN[3]
  const n = days.length

  const make = (
    index: number,
    title: string,
    focus: Focus,
    muscleGroups: MuscleGroup[],
    cardio: boolean,
    core: boolean,
  ): SessionSpec => ({
    index,
    weekday: days[index] ?? index,
    title,
    focus,
    muscleGroups,
    cardio,
    core,
  })

  switch (n) {
    case 1:
      return {
        name: '全身分化 ×1',
        sessions: [make(0, '全身训练 A', 'full', FULL, true, true)],
      }
    case 2:
      return {
        name: '全身分化 ×2',
        sessions: [
          make(0, '全身训练 A', 'full', FULL, false, true),
          make(1, '全身训练 B', 'full', ['back', 'quads', 'chest', 'hamstrings', 'shoulders'], true, true),
        ],
      }
    case 3:
      return {
        name: '推 / 拉 / 腿',
        sessions: [
          make(0, '推 · 胸肩三头', 'push', PUSH, false, true),
          make(1, '拉 · 背二头', 'pull', PULL, false, true),
          make(2, '腿 · 下肢', 'legs', LEGS, true, true),
        ],
      }
    case 4:
      return {
        name: '上肢 / 下肢分化',
        sessions: [
          make(0, '上肢 A', 'upper', UPPER, false, true),
          make(1, '下肢 A', 'lower', LOWER, false, false),
          make(2, '上肢 B', 'upper', ['back', 'chest', 'shoulders', 'triceps', 'biceps'], false, true),
          make(3, '下肢 B', 'lower', ['glutes', 'quads', 'hamstrings', 'calves'], true, true),
        ],
      }
    case 5:
      return {
        name: '推 / 拉 / 腿 + 弱项专项',
        sessions: [
          make(0, '推 · 胸肩三头', 'push', PUSH, false, false),
          make(1, '拉 · 背二头', 'pull', PULL, false, true),
          make(2, '腿 · 下肢', 'legs', LEGS, false, false),
          make(3, '弱项 · 上肢补强', 'weakpoint', ['shoulders', 'biceps', 'triceps'], false, true),
          make(4, '弱项 · 下肢与有氧', 'weakpoint', ['glutes', 'calves', 'hamstrings'], true, true),
        ],
      }
    case 6:
    default:
      return {
        name: '推 / 拉 / 腿 ×2',
        sessions: [
          make(0, '推 A · 胸肩三头', 'push', PUSH, false, false),
          make(1, '拉 A · 背二头', 'pull', PULL, false, true),
          make(2, '腿 A · 下肢', 'legs', LEGS, false, false),
          make(3, '推 B · 胸肩三头', 'push', ['shoulders', 'chest', 'triceps'], false, false),
          make(4, '拉 B · 背二头', 'pull', ['back', 'biceps'], false, true),
          make(5, '腿 B · 下肢与有氧', 'legs', ['glutes', 'quads', 'hamstrings', 'calves'], true, true),
        ],
      }
  }
}

/** 4 周中周期：第 4 周为减负周 */
export function isDeloadWeek(weekNumber: number, mesocycleWeeks = 4): boolean {
  return mesocycleWeeks >= 4 && weekNumber === mesocycleWeeks
}
