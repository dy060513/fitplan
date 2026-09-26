/**
 * FitPlan 数据模型
 * 所有实体均可序列化为 JSON，整体持久化到 localStorage（键：fitplan.state.v1）
 */

/* ------------------------------------------------------------------ */
/* 基础枚举                                                             */
/* ------------------------------------------------------------------ */

/** 性别：用于起始重量估算公式 */
export type Gender = 'male' | 'female' | 'other'

/** 训练经验 */
export type Experience = 'novice' | 'beginner' | 'intermediate'

/** 训练目标（单选） */
export type Goal = 'muscle' | 'fatloss' | 'strength' | 'toning' | 'health'

/** 伤病 / 禁忌部位（多选），用于过滤危险动作 */
export type BodyRegion = 'neck' | 'shoulder' | 'lowerBack' | 'knee' | 'wrist'

/** 器械偏好：影响同类动作里优先排自由重量还是固定器械 */
export type EquipmentPreference = 'free' | 'machine' | 'any'

/**
 * 部位侧重：不想练腿、不想练胸这类个人偏好
 * - none 不练：该肌群的动作不进计划（若某天因此没有目标肌群，会改为练其他正常部位）
 * - less 少练：每次训练该肌群最多 1 个动作
 * - normal 正常：按分化方案默认安排
 * - more 加强：每次训练该肌群多排动作并靠前
 */
export type MuscleEmphasis = 'none' | 'less' | 'normal' | 'more'

/** 训练容量覆盖：留空表示按目标 + 经验自动推导 */
export interface VolumePreference {
  /** 每次训练的动作数量（4–8） */
  exercisesPerSession?: number
  /** 每个动作的组数（2–6） */
  setsPerExercise?: number
  /** 每组目标次数（5–20） */
  repsPerSet?: number
}

/**
 * 每周训练节奏
 * - consecutive：连着练（周一起连续排）
 * - rest1：练一休一
 * - rest2：练二休一
 * - custom：自定义星期（customWeekdays）
 */
export type TrainingRhythm = 'consecutive' | 'rest1' | 'rest2' | 'custom'

/** 肌群 */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'cardio'

/** 动作模式（用于分化） */
export type MovementPattern = 'push' | 'pull' | 'legs' | 'core' | 'cardio'

/** 器械分类 */
export type EquipmentCategory = 'free' | 'machine' | 'cardio' | 'bodyweight'

/** 动作难度（与训练经验对应） */
export type ExerciseLevel = 'novice' | 'beginner' | 'intermediate'

/** 负重类型，决定重量估算与递增步长 */
export type LoadType =
  | 'barbell' // 杠铃，2.5kg 步长
  | 'dumbbell' // 哑铃（每只），0.5kg/1kg 步长
  | 'machine' // 固定器械 / 绳索，2.5kg 步长
  | 'bodyweight' // 自重，重量恒为 0，靠次数递进
  | 'weighted' // 自重 + 附加负重（壶铃/哑铃/弹力带），按件递进
  | 'band' // 弹力带，按阻力等级递进，重量为 0
  | 'cardio' // 有氧，按时间递进
  | 'timed' // 计时类（平板支撑等），按秒递进

/* ------------------------------------------------------------------ */
/* User / Profile                                                      */
/* ------------------------------------------------------------------ */

export interface User {
  id: string
  createdAt: string // ISO
  /** 首次进入展示免责声明，记录接受时间；为空表示未接受 */
  disclaimerAcceptedAt?: string
  /** 建档向导是否完成 */
  onboarded: boolean
}

/** 体重记录（支持多次记录，用于趋势图） */
export interface WeightLog {
  id: string
  date: string // YYYY-MM-DD
  kg: number
}

export interface Profile {
  id: string
  userId: string
  updatedAt: string

  heightCm: number
  weightKg: number
  age: number
  gender: Gender

  experience: Experience
  goal: Goal

  /** 每周可训练天数 1–6 */
  daysPerWeek: 1 | 2 | 3 | 4 | 5 | 6
  /** 单次训练时长（分钟） */
  sessionMinutes: 30 | 45 | 60 | 90

  /** 伤病与禁忌部位 */
  injuries: BodyRegion[]
  /** 其他需就医提示的情况（慢性病 / 孕期等） */
  medicalFlags: string[]

  /** 器械偏好：优先自由重量 / 固定器械 / 不限（缺省 any） */
  equipmentPreference?: EquipmentPreference
  /** 每周训练节奏（缺省 consecutive） */
  trainingRhythm?: TrainingRhythm
  /** 自定义训练日，0 = 周一 … 6 = 周日；仅 trainingRhythm = 'custom' 生效 */
  customWeekdays?: number[]
  /** 每周固定有氧日，0 = 周一 … 6 = 周日；命中当天生成纯有氧训练 */
  cardioWeekdays?: number[]
  /** 部位侧重，缺省为 normal */
  muscleEmphasis?: Partial<Record<MuscleGroup, MuscleEmphasis>>
  /** 训练容量覆盖，缺省按目标 + 经验自动推导 */
  volume?: VolumePreference

  /** 体重历史（含当前体重的最新一条） */
  weightLogs: WeightLog[]
}

/* ------------------------------------------------------------------ */
/* Equipment                                                           */
/* ------------------------------------------------------------------ */

export interface WeightRange {
  min: number
  max: number
  /** 建议递增步长，可留空由引擎推断 */
  step?: number
}

export interface Equipment {
  id: string
  name: string
  category: EquipmentCategory
  /** 可选重量范围，可留空 */
  weightRange?: WeightRange
  /** 是否用户自定义新增 */
  custom: boolean
  createdAt: string
}

/** 用户在器械库中勾选的器械 */
export interface EquipmentSelection {
  userId: string
  equipmentIds: string[]
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* Exercise                                                            */
/* ------------------------------------------------------------------ */

export interface Exercise {
  id: string
  /** 中文动作名 */
  name: string
  /** 依赖器械 id（硬约束：只有用户勾选了该器械，才会出现在计划里） */
  equipmentId: string
  muscleGroup: MuscleGroup
  secondaryMuscles: MuscleGroup[]
  pattern: MovementPattern
  level: ExerciseLevel
  /** 复合动作 / 孤立动作 */
  compound: boolean
  /** 单侧动作（重量按单只计） */
  unilateral?: boolean
  /** 可能加重伤病的部位，命中用户禁忌则过滤 */
  riskRegions: BodyRegion[]
  loadType: LoadType
  /**
   * 起始负重估算系数：总负重 = 体重 × loadFactor
   * bodyweight / band / cardio / timed 类型为 0
   */
  loadFactor: number
  /** 力量目标下的系数修正（默认 1） */
  strengthFactor?: number
  /** 动作要领，1–2 句 */
  cues: string[]
  /** 默认组间休息（秒），引擎会按目标覆盖 */
  restSeconds: number
  /** 计时类动作的每次时长（秒） */
  durationSeconds?: number
  /** 有氧类动作的每次时长（分钟） */
  cardioMinutes?: number
  /** 同肌群、同难度的替代动作 id（引擎会二次校验器械可用性） */
  alternatives: string[]
  /** 是否由用户自定义器械自动生成 */
  isCustom?: boolean
}

/* ------------------------------------------------------------------ */
/* Plan / PlanWeek / PlanSession / PlanExercise                        */
/* ------------------------------------------------------------------ */

export type SessionKind = 'warmup' | 'main' | 'cooldown'

export interface PlanExercise {
  /** 计划内动作实例 id */
  id: string
  exerciseId: string
  kind: SessionKind
  order: number
  /** 组数 */
  sets: number
  /** 每组目标次数（timed/cardio 类型分别为秒 / 分钟） */
  reps: number
  /** 建议起始重量（kg），自重类为 0 */
  suggestedWeightKg: number
  /** 组间休息秒数 */
  restSeconds: number
  /** 动作要领（生成时从动作库拷贝，便于快照） */
  cues: string[]
  /** 生成该处方的原因说明 */
  reason?: string
}

export interface WarmupItem {
  id: string
  name: string
  minutes: number
  /** 需要器械的 id；为空表示徒手，永远可用 */
  equipmentId?: string
  note?: string
}

export interface CooldownItem {
  id: string
  name: string
  seconds: number
  target: string
}

export interface PlanSession {
  id: string
  weekId: string
  /** 周内第几次训练，0 起 */
  index: number
  /** 计划中的星期几（0=周一），用于日历展示 */
  weekday: number
  title: string
  /** 分化关键词，如 推 / 拉 / 腿 / 全身 / 上肢 */
  focus: MovementPattern | 'full' | 'upper' | 'lower' | 'weakpoint'
  estimatedMinutes: number
  warmup: WarmupItem[]
  exercises: PlanExercise[]
  cooldown: CooldownItem[]
  status: 'planned' | 'done' | 'skipped'
}

export interface PlanWeek {
  id: string
  planId: string
  /** 1 起，4 周为一个中周期 */
  weekNumber: number
  /** 第 4 周为减负周 */
  isDeload: boolean
  sessions: PlanSession[]
}

export interface Plan {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
  /** 分化方案名称，如「推/拉/腿」 */
  splitName: string
  /** 中周期周数，默认 4 */
  mesocycleWeeks: number
  /** 计划起始日期（该日期所在周的周一） */
  startDate: string
  status: 'active' | 'archived'
  weeks: PlanWeek[]
  /** 由训练模板生成时记录来源，便于 UI 展示「来自模板（已可自由编辑）」 */
  sourceTemplateId?: string
  sourceTemplateName?: string
}

/* ------------------------------------------------------------------ */
/* WorkoutSet / WorkoutSession / Feedback                              */
/* ------------------------------------------------------------------ */

export interface WorkoutSet {
  id: string
  sessionId: string
  /** 关联计划动作（可为空：自由补录） */
  planExerciseId?: string
  exerciseId: string
  setIndex: number
  /** 目标次数 */
  targetReps: number
  /** 实际次数 */
  reps: number
  /** 实际重量（kg），自重为 0 */
  weightKg: number
  /** 是否完成该组 */
  done: boolean
  createdAt: string
}

export type SessionStatus = 'in-progress' | 'completed'

export interface WorkoutSession {
  id: string
  userId: string
  /** 关联计划与计划内训练（可为空） */
  planId?: string
  planSessionId?: string
  date: string // YYYY-MM-DD
  startedAt: string
  finishedAt?: string
  title: string
  focus?: string
  /** 实际时长（分钟） */
  durationMinutes?: number
  sets: WorkoutSet[]
  feedback?: Feedback
  status: SessionStatus
}

/** 完成度 */
export type Completion = 'all' | 'partial' | 'none'

export interface PainReport {
  region: BodyRegion
  /** 1 轻微 / 2 明显 / 3 剧烈 */
  level: 1 | 2 | 3
}

/** 单次反馈驱动的调整结果 */
export interface Adjustment {
  exerciseId: string
  exerciseName: string
  fromWeightKg: number
  toWeightKg: number
  fromReps: number
  toReps: number
  action: 'increase' | 'maintain' | 'decrease' | 'rest'
  reason: string
}

export interface Feedback {
  id: string
  sessionId: string
  createdAt: string
  /** 整体难度 RPE 1–10 */
  rpe: number
  completion: Completion
  /** 疲劳部位 */
  fatigueRegions: MuscleGroup[]
  /** 是否出现疼痛 */
  pain?: PainReport | null
  /** 本次实际时长（分钟） */
  actualMinutes: number
  note?: string
  /** 提交时即时生成的调整说明 */
  adjustments: Adjustment[]
  /** 系统提示（如"建议停止该动作并休息"） */
  advice: string[]
}

/* ------------------------------------------------------------------ */
/* 渐进超负荷状态                                                       */
/* ------------------------------------------------------------------ */

/** 单个动作的一次历史表现 */
export interface ExerciseRecord {
  /** YYYY-MM-DD */
  date: string
  sessionId: string
  weightKg: number
  reps: number
  /** 该次整体 RPE（取自训练反馈） */
  rpe: number
  /** 该动作是否完成全部目标次数 */
  completedAll: boolean
}

export interface ExerciseProgress {
  exerciseId: string
  /** 按时间正序 */
  history: ExerciseRecord[]
  /** 当前处方（下一次训练应使用的重量 / 次数） */
  currentWeightKg: number
  currentReps: number
  /** 连续达成次数（用于连续两次 RPE≤7 判定） */
  easyStreak: number
  /** 因疼痛被标记，需要暂停 */
  restUntil?: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 应用整体状态                                                         */
/* ------------------------------------------------------------------ */

export type ThemeMode = 'light' | 'dark'

export interface AppSettings {
  theme: ThemeMode
  /** 中周期周数 */
  mesocycleWeeks: number
  /** 是否显示重量单位为 kg（预留） */
  unit: 'kg'
}

export interface AppState {
  version: number
  user: User | null
  profile: Profile | null
  equipment: Equipment[] // 预置 + 自定义
  selectedEquipmentIds: string[]
  exercises: Exercise[] // 预置 + 自定义动作
  plan: Plan | null
  sessions: WorkoutSession[]
  progress: Record<string, ExerciseProgress>
  settings: AppSettings
}
