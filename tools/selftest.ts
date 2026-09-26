/**
 * 引擎自检脚本（纯函数，离线运行）
 * 运行：npm run selftest
 * 覆盖验收标准 1 / 2：器械硬约束、伤病过滤、渐进超负荷上调与疼痛下调
 */
import type { EquipmentPreference, Exercise, ExerciseProgress, Profile, WorkoutSet } from '@/types'
import { PRESET_EXERCISES } from '@/data/exercises'
import { PRESET_EQUIPMENT } from '@/data/equipment'
import { PLAN_TEMPLATES } from '@/data/templates'
import { generatePlan, flattenSessions, prescribeExercise } from '@/engine/generate'
import { expandTemplate } from '@/engine/template'
import { suggestWeekdays } from '@/engine/split'
import { applyFeedback } from '@/engine/progression'
import { findAlternatives, isSafeFor } from '@/engine/alternatives'
import { estimateStartWeight } from '@/engine/load'

let failed = 0
let passed = 0
const failures: string[] = []

function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    passed++
    console.log(`  [OK] ${name}`)
  } else {
    failed++
    failures.push(`${name} ${extra}`)
    console.log(`  [FAIL] ${name} ${extra}`)
  }
}

const profile: Profile = {
  id: 'p1',
  userId: 'u1',
  updatedAt: '',
  heightCm: 175,
  weightKg: 70,
  age: 28,
  gender: 'male',
  experience: 'beginner',
  goal: 'muscle',
  daysPerWeek: 3,
  sessionMinutes: 60,
  injuries: ['knee'],
  medicalFlags: [],
  weightLogs: [],
}

/* ---------------- 验收 1：器械硬约束 ---------------- */
console.log('\n[验收 1] 勾选 5 个器械 → 生成计划，动作全部来自已勾选器械')
const selected = ['eq_dumbbell', 'eq_barbell', 'eq_latpulldown', 'eq_legpress', 'eq_yogamat']
const plan = generatePlan({
  userId: 'u1',
  profile,
  exercises: PRESET_EXERCISES,
  equipment: PRESET_EQUIPMENT,
  selectedEquipmentIds: selected,
  mesocycleWeeks: 4,
  progress: {},
  startDateISO: '2026-09-21',
})

const byId = Object.fromEntries(PRESET_EXERCISES.map((e) => [e.id, e]))
const flat = flattenSessions(plan)
const allExercises: Exercise[] = flat.flatMap((f) => f.session.exercises.map((pe) => byId[pe.exerciseId]))

check('生成了 4 周计划', plan.weeks.length === 4)
check('每周训练次数 = 3（推/拉/腿）', plan.weeks[0].sessions.length === 3)
check(
  '所有动作均来自已勾选器械',
  allExercises.every((e) => selected.includes(e.equipmentId)),
  allExercises
    .filter((e) => !selected.includes(e.equipmentId))
    .map((e) => `${e.name}:${e.equipmentId}`)
    .join(','),
)
check(
  '所有动作都不触碰禁忌部位（膝）',
  allExercises.every((e) => !e.riskRegions.includes('knee')),
  allExercises
    .filter((e) => e.riskRegions.includes('knee'))
    .map((e) => `${e.name}:${e.riskRegions.join('/')}`)
    .join(','),
)
check('第 4 周为减负周', plan.weeks[3].isDeload)
const w1 = plan.weeks[0].sessions[0]
check('训练结构化：热身 + 主体 + 放松', w1.warmup.length > 0 && w1.exercises.length > 0 && w1.cooldown.length > 0)
check(
  '每个动作都有组数/次数/休息/建议重量/要领',
  w1.exercises.every((pe) => pe.sets > 0 && pe.reps > 0 && pe.restSeconds >= 0 && pe.suggestedWeightKg >= 0 && pe.cues.length > 0),
)
console.log(
  `    第1周第1次：${w1.title} · ${w1.exercises.length} 个动作 · 约 ${w1.estimatedMinutes} 分钟 · ` +
    w1.exercises
      .map((pe) => `${byId[pe.exerciseId].name} ${pe.sets}×${pe.reps} ${pe.suggestedWeightKg}kg`)
      .join(' | '),
)

/* ---------------- 替代动作 ---------------- */
console.log('\n[替代动作] 同肌群 + 同难度 + 器械可用')
const target = PRESET_EXERCISES.find((e) => e.id === 'ex_db_bench')!
const alts = findAlternatives(target, {
  exercises: PRESET_EXERCISES,
  selectedEquipmentIds: selected,
  injuries: profile.injuries,
})
check('给出了替代动作', alts.length > 0)
check(
  '替代动作都可用且安全',
  alts.every((a) => selected.includes(a.equipmentId) && !a.riskRegions.includes('knee')),
)

/* ---------------- 验收 2-1：RPE=4 → 上调 ---------------- */
console.log('\n[验收 2-1] 提交 RPE=4 反馈 → 重量上调')
const benchSession = plan.weeks[0].sessions[0]
const benchPe = benchSession.exercises.find((pe) => byId[pe.exerciseId].loadType === 'dumbbell') ?? benchSession.exercises[0]
const benchEx = byId[benchPe.exerciseId]

const mkSet = (weightKg: number, reps: number, done = true): WorkoutSet => ({
  id: 's',
  sessionId: 'ses1',
  exerciseId: benchEx.id,
  setIndex: 0,
  targetReps: benchPe.reps,
  reps,
  weightKg,
  done,
  createdAt: '',
})

const setsEasy = [mkSet(benchPe.suggestedWeightKg, benchPe.reps), mkSet(benchPe.suggestedWeightKg, benchPe.reps)]
const r1 = applyFeedback({
  plan,
  profile,
  exercisesById: byId,
  allExercises: PRESET_EXERCISES,
  selectedEquipmentIds: selected,
  progress: {},
  session: { id: 'ses1', date: flat[0].date, sets: setsEasy },
  feedback: { rpe: 4, completion: 'all', fatigueRegions: ['chest'], pain: null, actualMinutes: 55, note: '' },
})
const adjEasy = r1.adjustments.find((a) => a.exerciseId === benchEx.id)!
check(
  `${benchEx.name} 重量上调 ${adjEasy.fromWeightKg} → ${adjEasy.toWeightKg}`,
  adjEasy.action === 'increase' && adjEasy.toWeightKg > adjEasy.fromWeightKg,
  JSON.stringify(adjEasy),
)

/* ---------------- 验收 2-2：RPE=10 + 疼痛 → 下调 ---------------- */
console.log('\n[验收 2-2] 提交 RPE=10 + 疼痛 → 重量下调并提示休息')
const progressAfterEasy: Record<string, ExerciseProgress> = r1.progress
const r2 = applyFeedback({
  plan: r1.plan,
  profile,
  exercisesById: byId,
  allExercises: PRESET_EXERCISES,
  selectedEquipmentIds: selected,
  progress: progressAfterEasy,
  session: {
    id: 'ses2',
    date: flat[0].date,
    sets: [mkSet(adjEasy.toWeightKg, benchPe.reps, false), mkSet(adjEasy.toWeightKg, benchPe.reps - 3, false)],
  },
  feedback: {
    rpe: 10,
    completion: 'partial',
    fatigueRegions: ['chest', 'shoulders'],
    pain: { region: 'shoulder', level: 2 },
    actualMinutes: 40,
    note: '肩部疼痛',
  },
})
const adjHard = r2.adjustments.find((a) => a.exerciseId === benchEx.id)!
check(
  `${benchEx.name} 重量下调 ${adjHard.fromWeightKg} → ${adjHard.toWeightKg}`,
  adjHard.toWeightKg < adjHard.fromWeightKg,
  JSON.stringify(adjHard),
)
check('疼痛动作被标记暂停（rest）', adjHard.action === 'rest', adjHard.action)
check('给出休息建议', r2.advice.some((a) => a.includes('停止') && a.includes('就医')), r2.advice.join('|'))
check('设置了 7 天停用期', !!r2.progress[benchEx.id].restUntil)

// 停用期内（7 天）的后续训练不应再出现该动作
const restUntil = r2.progress[benchEx.id].restUntil!
const later = flattenSessions(r2.plan).filter((f) => f.date > flat[0].date && f.date < restUntil)
const stillUsed = later.some((f) => f.session.exercises.some((pe) => pe.exerciseId === benchEx.id))
check(`停用期内（${flat[0].date} ~ ${restUntil}）的 ${later.length} 次训练已替换该动作`, !stillUsed)

/* ---------------- 时长预算 ---------------- */
console.log('\n[时长预算] 单次训练估算时长接近用户设定')
const durations = flattenSessions(plan).map((f) => f.session.estimatedMinutes)
check(
  `估算时长在 ${profile.sessionMinutes} ± 12 分钟内（${durations.join('/')}）`,
  durations.every((d) => Math.abs(d - profile.sessionMinutes) <= 12),
)

/* ---------------- 起始重量估算 ---------------- */
console.log('\n[起始重量] 按体重与经验估算')
const squat = PRESET_EXERCISES.find((e) => e.id === 'ex_bb_squat')!
const rxNovice = prescribeExercise(squat, { ...profile, experience: 'novice' }, undefined)
const rxInt = prescribeExercise(squat, { ...profile, experience: 'intermediate' }, undefined)
check(`新手深蹲起始 ${rxNovice.weightKg}kg < 中级 ${rxInt.weightKg}kg`, rxNovice.weightKg < rxInt.weightKg)
check('重量按 2.5kg 取整', rxNovice.weightKg % 2.5 === 0)

/* ---------------- 器械库覆盖 ---------------- */
console.log('\n[器械库] 勾了就排得进计划')
// 泡沫轴属放松辅具，走放松环节（cooldown）而非主训练，因此不计入动作匹配
const FOAM_ROLLER = 'eq_foamroller'
const noExercise = PRESET_EQUIPMENT.filter(
  (e) => e.id !== FOAM_ROLLER && !PRESET_EXERCISES.some((x) => x.equipmentId === e.id),
)
check(
  `预置器械 ${PRESET_EQUIPMENT.length} 项均有对应动作（泡沫轴除外）`,
  noExercise.length === 0,
  noExercise.map((e) => e.name).join(','),
)
console.log(`    器械 ${PRESET_EQUIPMENT.length} 项 · 动作 ${PRESET_EXERCISES.length} 个`)

/* ---------------- 训练节奏 ---------------- */
console.log('\n[训练节奏] 练一休一 / 练二休一 / 自定义星期')
check('练一休一 3 练 → 周一/三/五', suggestWeekdays(3, 'rest1').join(',') === '0,2,4', suggestWeekdays(3, 'rest1').join(','))
check('练二休一 4 练 → 周一/二/四/五', suggestWeekdays(4, 'rest2').join(',') === '0,1,3,4', suggestWeekdays(4, 'rest2').join(','))
check('连续练 3 练 → 周一/二/三', suggestWeekdays(3, 'consecutive').join(',') === '0,1,2', suggestWeekdays(3, 'consecutive').join(','))
check('自定义 → 周二/四/六', suggestWeekdays(3, 'custom', [1, 3, 5]).join(',') === '1,3,5')

const restPlan = generatePlan({
  userId: 'u1',
  profile: { ...profile, daysPerWeek: 3, trainingRhythm: 'rest1' },
  exercises: PRESET_EXERCISES,
  equipment: PRESET_EQUIPMENT,
  selectedEquipmentIds: selected,
  mesocycleWeeks: 2,
  progress: {},
  startDateISO: '2026-09-21',
})
const restWeekdays = restPlan.weeks[0].sessions.map((s) => s.weekday).sort((a, b) => a - b)
check(`练一休一计划落在周一/三/五（${restWeekdays.join('/')}）`, restWeekdays.join(',') === '0,2,4')

/* ---------------- 自定义有氧日 ---------------- */
console.log('\n[有氧日] 指定某天为纯有氧训练')
const cardioSelected = [...selected, 'eq_treadmill']
const mkCardioPlan = (cardioWeekdays: number[]) =>
  generatePlan({
    userId: 'u1',
    profile: { ...profile, daysPerWeek: 3, trainingRhythm: 'consecutive', cardioWeekdays },
    exercises: PRESET_EXERCISES,
    equipment: PRESET_EQUIPMENT,
    selectedEquipmentIds: cardioSelected,
    mesocycleWeeks: 2,
    progress: {},
    startDateISO: '2026-09-21',
  })

const cardioPlan = mkCardioPlan([6])
const cw = cardioPlan.weeks[0].sessions
const cardioSession = cw.find((s) => s.weekday === 6)
check('周日（非力量日）被安排为有氧训练', !!cardioSession && cardioSession.focus === 'cardio')
check(
  '有氧日动作全部为有氧类',
  !!cardioSession && cardioSession.exercises.every((pe) => byId[pe.exerciseId].pattern === 'cardio'),
  cardioSession?.exercises.map((pe) => byId[pe.exerciseId].name).join(','),
)
check(
  '有氧日动作仍来自已勾选器械',
  !!cardioSession && cardioSession.exercises.every((pe) => cardioSelected.includes(byId[pe.exerciseId].equipmentId)),
)
const strengthDays = cw.filter((s) => s.weekday !== 6)
check(`其余 ${strengthDays.length} 天仍为力量训练`, strengthDays.length === 3 && strengthDays.every((s) => s.focus !== 'cardio'))

const overridePlan = mkCardioPlan([0])
const monday = overridePlan.weeks[0].sessions.find((s) => s.weekday === 0)
check('力量日被指定为有氧日时，当天改为纯有氧', !!monday && monday.focus === 'cardio')

/* ---------------- 器械偏好 ---------------- */
console.log('\n[器械偏好] 偏好固定器械 / 偏好自由重量')
const mixed = [
  'eq_dumbbell',
  'eq_barbell',
  'eq_bench',
  'eq_yogamat',
  'eq_chestpress',
  'eq_latpulldown',
  'eq_legpress',
  'eq_legext',
  'eq_legcurl',
  'eq_peckdeck',
  'eq_cable',
]
const categoryOf = (equipmentId: string) => PRESET_EQUIPMENT.find((e) => e.id === equipmentId)?.category
const countByCategory = (preference: EquipmentPreference) => {
  const pl = generatePlan({
    userId: 'u1',
    profile: { ...profile, equipmentPreference: preference },
    exercises: PRESET_EXERCISES,
    equipment: PRESET_EQUIPMENT,
    selectedEquipmentIds: mixed,
    mesocycleWeeks: 4,
    progress: {},
    startDateISO: '2026-09-21',
  })
  const list = flattenSessions(pl).flatMap((f) => f.session.exercises.map((pe) => byId[pe.exerciseId]))
  return {
    machine: list.filter((e) => categoryOf(e.equipmentId) === 'machine').length,
    free: list.filter((e) => categoryOf(e.equipmentId) === 'free').length,
  }
}
const mPref = countByCategory('machine')
const fPref = countByCategory('free')
console.log(`    偏好固定器械：固定 ${mPref.machine} / 自由 ${mPref.free}`)
console.log(`    偏好自由重量：固定 ${fPref.machine} / 自由 ${fPref.free}`)
check('偏好固定器械时，固定器械动作多于偏好自由重量时', mPref.machine > fPref.machine)
check('偏好自由重量时，自由重量动作多于偏好固定器械时', fPref.free > mPref.free)

/* ---------------- 部位侧重 ---------------- */
console.log('\n[部位侧重] 不练 / 少练 / 加强')
const mkEmphasisPlan = (muscleEmphasis: Profile['muscleEmphasis']) =>
  generatePlan({
    userId: 'u1',
    profile: { ...profile, muscleEmphasis },
    exercises: PRESET_EXERCISES,
    equipment: PRESET_EQUIPMENT,
    selectedEquipmentIds: mixed,
    mesocycleWeeks: 2,
    progress: {},
    startDateISO: '2026-09-21',
  })
const emphasisExercises = (muscleEmphasis: Profile['muscleEmphasis']) =>
  flattenSessions(mkEmphasisPlan(muscleEmphasis)).flatMap((f) =>
    f.session.exercises.map((pe) => byId[pe.exerciseId]),
  )

const noLegs = emphasisExercises({ quads: 'none', hamstrings: 'none', glutes: 'none' })
check(
  `「不练腿」后计划里没有腿部的 ${noLegs.filter((e) => ['quads', 'hamstrings', 'glutes'].includes(e.muscleGroup)).length} 个动作`,
  noLegs.length > 0 && noLegs.every((e) => !['quads', 'hamstrings', 'glutes'].includes(e.muscleGroup)),
  noLegs
    .filter((e) => ['quads', 'hamstrings', 'glutes'].includes(e.muscleGroup))
    .map((e) => e.name)
    .join(','),
)

const noChest = emphasisExercises({ chest: 'none' })
check(
  `「不练胸」后计划里没有胸部动作（共 ${noChest.length} 个动作）`,
  noChest.length > 0 && noChest.every((e) => e.muscleGroup !== 'chest'),
  noChest
    .filter((e) => e.muscleGroup === 'chest')
    .map((e) => e.name)
    .join(','),
)

const baseline = emphasisExercises({})
const lessChest = emphasisExercises({ chest: 'less' })
const moreBack = emphasisExercises({ back: 'more' })
const countGroup = (list: Exercise[], g: string) => list.filter((e) => e.muscleGroup === g).length
console.log(
  `    胸部动作：默认 ${countGroup(baseline, 'chest')} → 少练 ${countGroup(lessChest, 'chest')}；` +
    `背部动作：默认 ${countGroup(baseline, 'back')} → 加强 ${countGroup(moreBack, 'back')}`,
)
check('「少练胸」后胸部动作少于默认', countGroup(lessChest, 'chest') < countGroup(baseline, 'chest'))
check('「加强背」后背部动作多于默认', countGroup(moreBack, 'back') > countGroup(baseline, 'back'))
check(
  '每次训练的胸部动作不超过 1 个（少练时）',
  flattenSessions(mkEmphasisPlan({ chest: 'less' })).every(
    (f) => f.session.exercises.filter((pe) => byId[pe.exerciseId].muscleGroup === 'chest').length <= 1,
  ),
)

/* ---------------- 训练容量 ---------------- */
console.log('\n[训练容量] 自定义 6 动作 × 4 组 × 12 次')
const volumePlan = generatePlan({
  userId: 'u1',
  profile: { ...profile, volume: { exercisesPerSession: 6, setsPerExercise: 4, repsPerSet: 12 } },
  exercises: PRESET_EXERCISES,
  equipment: PRESET_EQUIPMENT,
  selectedEquipmentIds: mixed,
  mesocycleWeeks: 2,
  progress: {},
  startDateISO: '2026-09-21',
})
const volumeSessions = flattenSessions(volumePlan).map((f) => f.session)
const counts = volumeSessions.map((s) => s.exercises.length)
check(`每次训练都是 6 个动作（${counts.join('/')}）`, counts.length > 0 && counts.every((c) => c === 6))
const loadable = volumeSessions.flatMap((s) =>
  s.exercises.filter((pe) => {
    const lt = byId[pe.exerciseId].loadType
    return lt !== 'cardio' && lt !== 'timed'
  }),
)
check(
  `所有负重/自重动作都是 4 组 × 12 次（共 ${loadable.length} 个）`,
  loadable.length > 0 && loadable.every((pe) => pe.sets === 4 && pe.reps === 12),
  loadable
    .filter((pe) => pe.sets !== 4 || pe.reps !== 12)
    .map((pe) => `${byId[pe.exerciseId].name} ${pe.sets}×${pe.reps}`)
    .join(','),
)
check(
  '自定义容量后动作仍全部来自已勾选器械',
  volumeSessions.every((s) => s.exercises.every((pe) => mixed.includes(byId[pe.exerciseId].equipmentId))),
)
console.log(
  `    示例：${volumeSessions[0].title} · ${volumeSessions[0].exercises.length} 动作 · ` +
    `${volumeSessions[0].exercises.map((pe) => `${byId[pe.exerciseId].name} ${pe.sets}×${pe.reps}`).join(' | ')}`,
)

console.log('\n[验收 8] 训练模板：薄肌训练法可展开为可执行计划')
{
  const stage1 = PLAN_TEMPLATES.find((t) => t.id === 'tpl_thin_muscle_stage1')!
  const stage3 = PLAN_TEMPLATES.find((t) => t.id === 'tpl_thin_muscle_stage3')!
  // 勾选很少的器械，验证模板会自动补齐
  const r1 = expandTemplate({
    template: stage1,
    userId: 'u1',
    profile,
    exercises: PRESET_EXERCISES,
    selectedEquipmentIds: ['eq_yogamat'],
    mesocycleWeeks: 4,
    progress: {},
    startDateISO: '2026-09-21',
  })
  const w1s1 = r1.plan.weeks[0].sessions.find((s) => s.weekday === 0)!
  const first = w1s1.exercises[0]
  const firstEx = byId[first.exerciseId]
  check('模板生成 4 周计划', r1.plan.weeks.length === 4)
  check('第一阶段每周 5 次训练', r1.plan.weeks[0].sessions.length === 5)
  check(
    '第 1 天第 1 个动作是平板卧推 4 × 8',
    firstEx.id === 'ex_bb_bench' && first.sets === 4 && first.reps === 8,
    `${firstEx.id} ${first.sets}×${first.reps}`,
  )
  check(
    '缺失器械被自动补齐（含卧推架 / 绳索 / 深蹲架）',
    ['eq_bench', 'eq_cable', 'eq_squatrack'].every((id) => r1.addedEquipmentIds.includes(id)),
    r1.addedEquipmentIds.join(','),
  )
  check(
    '补齐后所有动作的器械都可用',
    r1.plan.weeks
      .flatMap((w) => w.sessions)
      .flatMap((s) => s.exercises)
      .every((pe) => r1.addedEquipmentIds.concat('eq_yogamat').includes(byId[pe.exerciseId].equipmentId)),
  )
  check(
    '伤病过滤：用户有膝伤时不会出现深蹲 / 腿举等禁忌动作',
    r1.plan.weeks
      .flatMap((w) => w.sessions)
      .flatMap((s) => s.exercises)
      .every((pe) => isSafeFor(byId[pe.exerciseId], profile.injuries)),
  )
  check('替换被记录下来（substitutions 非空）', r1.substitutions.length > 0)
  const bench = w1s1.exercises.find((pe) => pe.exerciseId === 'ex_bb_bench')
  check(
    '70% 处方重量 = 按体重估算的起始重量（70% 基准）',
    !!bench && bench.suggestedWeightKg === estimateStartWeight(byId['ex_bb_bench'], profile),
    bench ? `${bench.suggestedWeightKg}` : '未找到',
  )

  const r3 = expandTemplate({
    template: stage3,
    userId: 'u1',
    profile,
    exercises: PRESET_EXERCISES,
    selectedEquipmentIds: ['eq_yogamat'],
    mesocycleWeeks: 4,
    progress: {},
    startDateISO: '2026-09-21',
  })
  const w3s1 = r3.plan.weeks[0].sessions.find((s) => s.weekday === 0)!
  const heavy = w3s1.exercises.find((pe) => pe.exerciseId === 'ex_bb_bench')
  check(
    '第三阶段 90% 处方重量高于 70% 基准',
    !!heavy &&
      heavy.suggestedWeightKg >
        Math.round(estimateStartWeight(byId['ex_bb_bench'], profile) / 2.5) * 2.5,
    heavy ? `${heavy.suggestedWeightKg}` : '未找到',
  )
  check('冲击期模板不设减负周', r3.plan.weeks.every((w) => !w.isDeload))
  check('模板计划带来源信息', r3.plan.sourceTemplateId === 'tpl_thin_muscle_stage3')
  console.log(
    `    示例：${w1s1.title} · ${w1s1.exercises
      .map((pe) => `${byId[pe.exerciseId].name} ${pe.sets}×${pe.reps}${pe.suggestedWeightKg ? `@${pe.suggestedWeightKg}kg` : ''}`)
      .join(' | ')}`,
  )
}

console.log(`\nRESULT passed=${passed} failed=${failed}`)
if (failures.length) console.log('FAILED CASES:\n - ' + failures.join('\n - '))
if (failed > 0) process.exit(1)
