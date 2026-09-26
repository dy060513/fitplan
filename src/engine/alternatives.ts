import type { BodyRegion, Exercise, MuscleGroup } from '@/types'

const LEVEL_RANK: Record<Exercise['level'], number> = { novice: 0, beginner: 1, intermediate: 2 }

export interface AlternativeOptions {
  /** 全部动作（含自定义） */
  exercises: Exercise[]
  /** 用户已勾选的器械 id（硬约束） */
  selectedEquipmentIds: string[]
  /** 用户伤病禁忌 */
  injuries: BodyRegion[]
  /** 需要排除的动作 id（已在计划中出现 / 被替换的动作本身） */
  excludeIds?: string[]
}

/**
 * 伤病过滤：动作的风险部位与用户禁忌有交集则不可用
 */
export function isSafeFor(exercise: Exercise, injuries: BodyRegion[]): boolean {
  if (!injuries.length) return true
  return !exercise.riskRegions.some((r) => injuries.includes(r))
}

/**
 * 器械约束：动作依赖的器械必须在已勾选列表内
 */
export function isAvailableFor(exercise: Exercise, selectedEquipmentIds: string[]): boolean {
  return selectedEquipmentIds.includes(exercise.equipmentId)
}

/**
 * 查找同肌群、同难度的替代动作
 * 排序规则：主肌群一致 > 难度接近 > 复合/孤立一致 > 显式声明的替代 > 未使用过
 */
export function findAlternatives(
  target: Exercise,
  opts: AlternativeOptions,
  limit = 6,
): Exercise[] {
  const { exercises, selectedEquipmentIds, injuries, excludeIds = [] } = opts
  const exclude = new Set(excludeIds)
  exclude.add(target.id)

  const pool = exercises.filter(
    (e) =>
      !exclude.has(e.id) &&
      isAvailableFor(e, selectedEquipmentIds) &&
      isSafeFor(e, injuries) &&
      e.loadType !== 'cardio' === (target.loadType !== 'cardio'),
  )

  const explicit = new Set(target.alternatives ?? [])

  const scored = pool
    .filter((e) => e.muscleGroup === target.muscleGroup || e.secondaryMuscles.includes(target.muscleGroup as MuscleGroup))
    .map((e) => {
      let score = 0
      if (e.muscleGroup === target.muscleGroup) score += 5
      score += 2 - Math.abs(LEVEL_RANK[e.level] - LEVEL_RANK[target.level])
      if (e.compound === target.compound) score += 1
      if (e.pattern === target.pattern) score += 1
      if (explicit.has(e.id)) score += 3
      if (e.equipmentId === target.equipmentId) score -= 2 // 优先换器械
      return { exercise: e, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((s) => s.exercise)
}

/**
 * 因疼痛需要停用某动作时，挑一个风险部位不重叠的最安全替代
 */
export function findSafeReplacement(
  target: Exercise,
  opts: AlternativeOptions & { painfulRegion?: BodyRegion },
): Exercise | null {
  const { painfulRegion } = opts
  const candidates = findAlternatives(target, opts, 12)
  if (painfulRegion) {
    const safer = candidates.filter((e) => !e.riskRegions.includes(painfulRegion))
    if (safer.length) return safer[0]
  }
  return candidates[0] ?? null
}
