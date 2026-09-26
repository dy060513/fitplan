import type {
  BodyRegion,
  Equipment,
  EquipmentPreference,
  Exercise,
  ExerciseProgress,
  MuscleEmphasis,
  MuscleGroup,
  Plan,
  PlanExercise,
  PlanSession,
  PlanWeek,
  Profile,
} from '@/types'
import { COOLDOWN_POOL, WARMUP_POOL } from '@/data/exercises'
import { isAvailableFor, isSafeFor } from './alternatives'
import { estimateStartWeight, adjustWeightByPercent, isUnloaded } from './load'
import { estimateExerciseMinutes, prescribe } from './prescription'
import { chooseSplit, isDeloadWeek, suggestWeekdays, type Focus, type SessionSpec } from './split'
import { hashString, mulberry32, startOfWeekISO, uid } from '@/lib/utils'

const LEVEL_RANK: Record<Exercise['level'], number> = { novice: 0, beginner: 1, intermediate: 2 }

const COOLDOWN_BY_MUSCLE: Record<MuscleGroup, string[]> = {
  chest: ['cd_chest'],
  back: ['cd_lat'],
  shoulders: ['cd_shoulder'],
  biceps: ['cd_triceps'],
  triceps: ['cd_triceps'],
  quads: ['cd_quad'],
  hamstrings: ['cd_ham'],
  glutes: ['cd_glute'],
  calves: ['cd_calf'],
  core: [],
  cardio: [],
}

const WARMUP_MINUTES: Record<number, number> = { 30: 5, 45: 6, 60: 8, 90: 10 }

/** 器械偏好对候选动作排序的影响幅度（小于复合动作权重 10，因此不会把孤立动作顶到复合动作前面） */
const PREF_WEIGHT = 3

export interface GenerateInput {
  userId: string
  profile: Profile
  exercises: Exercise[]
  /** 完整器械列表（含自定义），用于按器械分类做偏好加权 */
  equipment: Equipment[]
  selectedEquipmentIds: string[]
  mesocycleWeeks: number
  progress: Record<string, ExerciseProgress>
  startDateISO: string
  /** 由训练节奏推导出的训练日（0 = 周一）；不传则按 profile 内部推导 */
  weekdays?: number[]
}

/** 单个动作的完整处方（供生成与"重新处方"共用） */
export function prescribeExercise(
  exercise: Exercise,
  profile: Profile,
  progressEntry: ExerciseProgress | undefined,
  opts: { deload?: boolean } = {},
): { sets: number; reps: number; restSeconds: number; weightKg: number } {
  const base = prescribe(exercise, profile.goal, profile.experience, { ...opts, volume: profile.volume })

  let weightKg: number
  let reps: number

  if (isUnloaded(exercise.loadType)) {
    weightKg = 0
    reps = progressEntry?.currentReps && progressEntry.currentReps > 0 ? progressEntry.currentReps : base.reps
  } else if (progressEntry && progressEntry.currentWeightKg > 0) {
    weightKg = progressEntry.currentWeightKg
    reps = progressEntry.currentReps > 0 ? progressEntry.currentReps : base.reps
  } else {
    weightKg = estimateStartWeight(exercise, profile)
    reps = base.reps
  }

  // 减负周：重量下调 10%
  if (opts.deload && weightKg > 0) {
    weightKg = adjustWeightByPercent(exercise.loadType, weightKg, -0.1)
  }

  return { sets: base.sets, reps, restSeconds: base.restSeconds, weightKg }
}

export function buildWarmup(minutes: number, seed: number): PlanSession['warmup'] {
  const target = WARMUP_MINUTES[minutes] ?? 6
  const order = ['wu_joint', 'wu_arm_circle', 'wu_body_squat', 'wu_lunge_walk', 'wu_glute_bridge', 'wu_plank']
  const items: PlanSession['warmup'] = []
  let total = 0
  for (const id of order) {
    const item = WARMUP_POOL.find((w) => w.id === id)
    if (!item) continue
    if (total + item.minutes > target && items.length > 0) break
    items.push({
      id: `${id}_${seed}`,
      name: item.name,
      minutes: item.minutes,
      note: item.note,
    })
    total += item.minutes
  }
  return items
}

export function buildCooldown(
  groups: MuscleGroup[],
  minutes: number,
  selectedEquipmentIds: string[],
): PlanSession['cooldown'] {
  const ids: string[] = []
  for (const g of groups) {
    for (const id of COOLDOWN_BY_MUSCLE[g] ?? []) {
      if (!ids.includes(id)) ids.push(id)
    }
  }
  if (minutes >= 60) ids.push('cd_breath')
  // 勾选了放松辅具（如泡沫轴）时补入对应放松项
  for (const item of COOLDOWN_POOL) {
    if (!item.equipmentId) continue
    if (ids.includes(item.id)) continue
    if (selectedEquipmentIds.includes(item.equipmentId)) ids.push(item.id)
  }
  if (!ids.length) ids.push('cd_breath')
  return ids.slice(0, 5).map((id, i) => {
    const item = COOLDOWN_POOL.find((c) => c.id === id)!
    return { id: `${id}_${i}`, name: item.name, seconds: item.seconds, target: item.target }
  })
}

type EmphasisMap = Profile['muscleEmphasis']

const EMPHASIS_WEIGHT: Record<MuscleEmphasis, number> = { more: -2, normal: 0, less: 2, none: 100 }

const emphasisOf = (m: EmphasisMap | undefined, g: MuscleGroup): MuscleEmphasis => m?.[g] ?? 'normal'
const isAvoided = (m: EmphasisMap | undefined, ex: Exercise) => emphasisOf(m, ex.muscleGroup) === 'none'

/** 每次训练该肌群最多排几个动作 */
function quotaOf(m: EmphasisMap | undefined, g: MuscleGroup): number {
  const e = emphasisOf(m, g)
  if (e === 'more') return 4
  if (e === 'less') return 1
  return 2
}

/** 过滤掉「不练」的肌群；若某天目标肌群全被排除，改练其他正常部位，避免出现空训练 */
function activeGroups(groups: MuscleGroup[], m: EmphasisMap | undefined): MuscleGroup[] {
  const kept = groups.filter((g) => emphasisOf(m, g) !== 'none')
  if (kept.length) return kept
  const fallback = (['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'] as MuscleGroup[]).filter(
    (g) => emphasisOf(m, g) !== 'none',
  )
  return fallback.length ? fallback.slice(0, 3) : groups
}

interface PickContext {
  exercises: Exercise[]
  selectedEquipmentIds: string[]
  injuries: BodyRegion[]
  experience: Profile['experience']
  rand: () => number
  /** 器械偏好加权：返回负数表示优先 */
  prefBonus: (equipmentId: string) => number
  /** 部位侧重 */
  emphasis?: EmphasisMap
}

/**
 * 器械偏好加权
 * 偏好自由重量时，自由重量类动作排序提前、固定器械类靠后（反之亦然）；
 * 自重 / 有氧类器械保持中立，不参与偏好竞争。
 */
function makePrefBonus(
  equipment: Equipment[],
  preference: EquipmentPreference,
): (equipmentId: string) => number {
  if (preference === 'any') return () => 0
  const categoryById = new Map(equipment.map((e) => [e.id, e.category]))
  return (equipmentId: string) => {
    const category = categoryById.get(equipmentId)
    if (!category) return 0
    if (category === preference) return -PREF_WEIGHT
    if (category === 'free' || category === 'machine') return PREF_WEIGHT
    return 0
  }
}

/** 某肌群的候选动作：器械已勾选 + 不触碰禁忌 + 难度不超过用户水平 */
function candidatesFor(ctx: PickContext, group: MuscleGroup, allowHarder: boolean): Exercise[] {
  const maxLevel = LEVEL_RANK[ctx.experience]
  const pool = ctx.exercises.filter(
    (e) =>
      (e.muscleGroup === group || e.secondaryMuscles.includes(group)) &&
      e.pattern !== 'cardio' &&
      isAvailableFor(e, ctx.selectedEquipmentIds) &&
      isSafeFor(e, ctx.injuries),
  )
  const matched = pool.filter((e) => allowHarder || LEVEL_RANK[e.level] <= maxLevel)
  const list = matched.length ? matched : pool
  // 复合动作优先，其次按器械偏好 + 部位侧重加权，最后确定性随机打散，保证同一输入结果稳定
  return list
    .map((e) => ({
      e,
      k:
        (e.compound ? 0 : 10) +
        ctx.prefBonus(e.equipmentId) +
        EMPHASIS_WEIGHT[emphasisOf(ctx.emphasis, e.muscleGroup)] +
        ctx.rand(),
    }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.e)
}

/**
 * 挑选本次训练的动作
 * @param spec 为 null 表示这一天是「纯有氧日」
 */
function pickExercises(
  ctx: PickContext,
  spec: SessionSpec | null,
  profile: Profile,
  deload: boolean,
  budget: number,
): Exercise[] {
  const picked: Exercise[] = []
  const used = new Set<string>()
  const minutesOf = (ex: Exercise) =>
    estimateExerciseMinutes(
      prescribe(ex, profile.goal, profile.experience, { deload, volume: profile.volume }),
      ex,
    )

  // 纯有氧日：在时长预算内循环排入有氧动作
  if (!spec) {
    const cands = ctx.exercises.filter(
      (e) => e.pattern === 'cardio' && isAvailableFor(e, ctx.selectedEquipmentIds) && isSafeFor(e, ctx.injuries),
    )
    if (!cands.length) return picked
    let minutes = 0
    while (minutes < budget && picked.length < 4) {
      const next = cands[picked.length % cands.length]
      const cost = minutesOf(next)
      if (picked.length && minutes + cost > budget + 6) break
      picked.push(next)
      minutes += cost
    }
    return picked
  }

  const emphasis = ctx.emphasis
  const avoid = (ex: Exercise) => isAvoided(emphasis, ex)
  const groups = activeGroups(spec.muscleGroups, emphasis)
  const wantCore = spec.core && emphasisOf(emphasis, 'core') !== 'none'
  const countOf = (g: MuscleGroup) => picked.filter((ex) => ex.muscleGroup === g).length

  // 第一轮：每个目标肌群各取一个（优先复合动作）
  for (const group of groups) {
    const cands = candidatesFor(ctx, group, false).filter((e) => !avoid(e))
    const pick =
      cands.find((e) => !used.has(e.id)) ??
      candidatesFor(ctx, group, true).filter((e) => !avoid(e)).find((e) => !used.has(e.id))
    if (pick) {
      picked.push(pick)
      used.add(pick.id)
    }
  }

  // 核心
  if (wantCore) {
    const corePick = candidatesFor(ctx, 'core', false).filter((e) => !avoid(e)).find((e) => !used.has(e.id))
    if (corePick) {
      picked.push(corePick)
      used.add(corePick.id)
    }
  }

  // 第二轮起：继续补充
  // 动作数量：用户指定了就用用户的；否则按时长预算推导，尽量让估算时长贴近用户设定
  const explicitCount = profile.volume?.exercisesPerSession
  const maxExercises = explicitCount
    ? Math.max(3, Math.min(10, Math.round(explicitCount)))
    : Math.max(4, Math.min(10, Math.ceil(budget / 4.5)))
  // 用户明确指定动作数时，允许更大幅度超出时长预算（这是他的选择）
  const allowance = explicitCount ? 12 : 4

  let usedMinutes = picked.reduce((s, ex) => s + minutesOf(ex), 0)
  const allGroups = [...groups, ...(wantCore ? (['core'] as MuscleGroup[]) : [])]
  let round = 0
  while (picked.length < maxExercises && round < 6) {
    // 前 2 轮严格按侧重上限；之后（以及用户指定了动作数时）放宽到每肌群 3 个，
    // 「少练」始终保持 1 个。这样既尊重侧重偏好，又不会因为候选不足导致单次时长明显偏短
    const relaxed = !!explicitCount || round >= 2
    const quotaFor = (g: MuscleGroup) =>
      emphasisOf(emphasis, g) === 'less' ? 1 : Math.max(quotaOf(emphasis, g), relaxed ? 3 : 2)
    // 配额按动作的「主肌群」统计：某动作被其他肌群组挑走时，同样受自己主肌群的配额约束
    const withinQuota = (ex: Exercise) => countOf(ex.muscleGroup) < quotaFor(ex.muscleGroup)

    let added = false
    for (const group of allGroups) {
      if (picked.length >= maxExercises) break
      if (countOf(group) >= quotaFor(group)) continue
      const cands = candidatesFor(ctx, group, false).filter((e) => !avoid(e))
      const next = cands.find((e) => !used.has(e.id) && withinQuota(e))
      if (!next) continue
      const cost = minutesOf(next)
      // 允许一定超额，避免最后一个动作排不进去导致时长明显偏短
      if (usedMinutes + cost > budget + allowance && picked.length >= 3) continue
      picked.push(next)
      used.add(next.id)
      usedMinutes += cost
      added = true
    }
    if (!added && relaxed) break
    // 本轮按侧重上限排不进去时，放宽上限再试一轮；仍排不进才结束
    if (!added) {
      round = 2
      continue
    }
    // 自动模式下严格按时长预算控制
    if (!explicitCount && usedMinutes >= budget) break
    round++
  }

  // 有氧（在时长预算内，且已勾选有氧器械）
  if (spec.cardio) {
    const cardioCands = ctx.exercises.filter(
      (e) => e.pattern === 'cardio' && isAvailableFor(e, ctx.selectedEquipmentIds) && isSafeFor(e, ctx.injuries),
    )
    const cardioPick = cardioCands.find((e) => !used.has(e.id))
    // 用户指定了动作数时，有氧也算在这 N 个动作之内
    if (cardioPick && usedMinutes < budget && (!explicitCount || picked.length < maxExercises)) {
      picked.push(cardioPick)
      used.add(cardioPick.id)
    }
  }

  // 保底：至少 3 个动作（同样跳过「不练」的部位）
  if (picked.length < 3) {
    for (const ex of ctx.exercises) {
      if (picked.length >= 3) break
      if (used.has(ex.id)) continue
      if (!isAvailableFor(ex, ctx.selectedEquipmentIds) || !isSafeFor(ex, ctx.injuries)) continue
      if (ex.pattern === 'cardio' || avoid(ex)) continue
      picked.push(ex)
      used.add(ex.id)
    }
  }

  return picked
}

/**
 * 生成完整计划（4 周中周期）
 * 硬约束：所有动作必须来自已勾选器械，且不与伤病禁忌冲突
 * 排期：按 profile.trainingRhythm 决定训练日；cardioWeekdays 命中的当天为纯有氧日
 */
export function generatePlan(input: GenerateInput): Plan {
  const {
    userId,
    profile,
    exercises,
    equipment,
    selectedEquipmentIds,
    mesocycleWeeks,
    progress,
    startDateISO,
  } = input

  const weekdays =
    input.weekdays ??
    suggestWeekdays(profile.daysPerWeek, profile.trainingRhythm ?? 'consecutive', profile.customWeekdays ?? [])
  const split = chooseSplit(profile.daysPerWeek, weekdays)
  const startDate = startOfWeekISO(startDateISO)
  const planId = uid('plan')

  const prefBonus = makePrefBonus(equipment, profile.equipmentPreference ?? 'any')
  const cardioWeekdays = [...new Set(profile.cardioWeekdays ?? [])].filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6,
  )
  const cardioDaySet = new Set(cardioWeekdays)
  /** 有氧日未被训练日覆盖时的额外有氧训练日（0 = 周一） */
  const extraCardioWeekdays = cardioWeekdays.filter((d) => !weekdays.includes(d)).sort((a, b) => a - b)
  const hasCardioEquipment = exercises.some(
    (e) => e.pattern === 'cardio' && isAvailableFor(e, selectedEquipmentIds),
  )

  // 确定性种子：不包含随机 planId，保证同一输入生成同一计划
  const baseSeed = [
    userId,
    startDate,
    profile.daysPerWeek,
    profile.goal,
    profile.experience,
    profile.sessionMinutes,
    [...selectedEquipmentIds].sort().join(','),
  ].join('|')

  const weeks: PlanWeek[] = []

  for (let w = 1; w <= mesocycleWeeks; w++) {
    const deload = isDeloadWeek(w, mesocycleWeeks)
    const weekId = uid('week')
    const sessions: PlanSession[] = []

    const build = (index: number, weekday: number, spec: SessionSpec | null, seedKey: string) => {
      const seed = hashString(`${baseSeed}|${w}|${seedKey}`)
      const rand = mulberry32(seed)
      const ctx: PickContext = {
        exercises,
        selectedEquipmentIds,
        injuries: profile.injuries,
        experience: profile.experience,
        rand,
        prefBonus,
        emphasis: profile.muscleEmphasis,
      }

      const warmup = buildWarmup(profile.sessionMinutes, seed)
      const cooldown = buildCooldown(
        spec ? activeGroups(spec.muscleGroups, profile.muscleEmphasis) : [],
        profile.sessionMinutes,
        selectedEquipmentIds,
      )
      const warmupMinutes = warmup.reduce((s, i) => s + i.minutes, 0)
      const cooldownMinutes = Math.round(cooldown.reduce((s, i) => s + i.seconds, 0) / 60)
      const budget = Math.max(10, profile.sessionMinutes - warmupMinutes - cooldownMinutes)

      const isCardioDay = spec === null
      const picked = pickExercises(ctx, spec, profile, deload, budget)

      const planExercises: PlanExercise[] = picked.map((ex, i) => {
        const rx = prescribeExercise(ex, profile, progress[ex.id], { deload })
        return {
          id: uid('pex'),
          exerciseId: ex.id,
          kind: 'main',
          order: i,
          sets: rx.sets,
          reps: rx.reps,
          restSeconds: rx.restSeconds,
          suggestedWeightKg: rx.weightKg,
          cues: ex.cues,
          reason:
            rx.weightKg > 0
              ? `按体重 × 经验估算起始重量 ${rx.weightKg}kg`
              : '自重 / 计时动作，通过次数与时长递进',
        }
      })

      const estimated =
        warmupMinutes +
        planExercises.reduce(
          (s, pe) =>
            s +
            estimateExerciseMinutes(
              { sets: pe.sets, reps: pe.reps, restSeconds: pe.restSeconds },
              picked[pe.order] ?? picked[0],
            ),
          0,
        ) +
        cooldownMinutes

      sessions.push({
        id: uid('pses'),
        weekId,
        index,
        weekday,
        title: isCardioDay ? '有氧日 · 心肺训练' : spec!.title,
        focus: (isCardioDay ? 'cardio' : spec!.focus) as Focus,
        estimatedMinutes: Math.round(estimated),
        warmup,
        exercises: planExercises,
        cooldown,
        status: 'planned',
      })
    }

    split.sessions.forEach((spec, i) => {
      const asCardioDay = cardioDaySet.has(spec.weekday) && hasCardioEquipment
      build(i, spec.weekday, asCardioDay ? null : spec, `s${spec.index}`)
    })
    extraCardioWeekdays.forEach((weekday, k) => {
      build(split.sessions.length + k, weekday, null, `c${weekday}`)
    })

    sessions.sort((a, b) => a.weekday - b.weekday)
    weeks.push({ id: weekId, planId, weekNumber: w, isDeload: deload, sessions })
  }

  return {
    id: planId,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    splitName: split.name,
    mesocycleWeeks,
    startDate,
    status: 'active',
    weeks,
  }
}

/** 计划内某次训练对应的实际日期 */
export function sessionDate(plan: Plan, weekNumber: number, weekday: number): string {
  const base = plan.startDate
  const [y, m, d] = base.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + (weekNumber - 1) * 7 + weekday)
  const yy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** 计划中所有（周，训练）的扁平列表，按日期排序 */
export function flattenSessions(plan: Plan): { week: PlanWeek; session: PlanSession; date: string }[] {
  const out: { week: PlanWeek; session: PlanSession; date: string }[] = []
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      out.push({ week, session, date: sessionDate(plan, week.weekNumber, session.weekday) })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export type { SessionSpec }
