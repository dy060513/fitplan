import type { PlanSession } from '@/types'

/**
 * 训练模板
 * ------------------------------------------------------------------
 * 模板是一份「别人写好的固定处方」：动作、组数、次数、重量比例都由模板给出，
 * 不参与引擎的自动分化与自动容量推导。
 *
 * weightPct 语义：以「系统按体重估算的起始重量 ≈ 70% 极限重量」为基准，
 * 换算成模板指定的百分比。例如 83 表示 83% 极限重量。
 *
 * 用户套用后会生成一份普通 Plan，之后可以逐项改组数 / 次数 / 重量，
 * 也可以换动作、删动作，与自动生成计划完全同权。
 */

export interface TemplateExercise {
  exerciseId: string
  /** 组数 */
  sets: number
  /** 每组目标次数；timed 类型单位为「秒」，cardio 类型单位为「分钟」 */
  reps: number
  /** 相对极限重量的百分比（省略则由引擎按体重估算） */
  weightPct?: number
  /** 展示用备注，例如「每次增加 5 公斤」 */
  note?: string
}

export interface TemplateSession {
  title: string
  /** 训练日（0 = 周一 … 6 = 周日） */
  weekday: number
  focus: PlanSession['focus']
  exercises: TemplateExercise[]
}

export interface PlanTemplate {
  id: string
  name: string
  /** 出处 / 作者，用于免责与溯源 */
  source: string
  /** 一句话简介 */
  summary: string
  /** 训练思路说明，展示在套用前 */
  principle: string[]
  tags: string[]
  daysPerWeek: number
  /** 单次预计时长（分钟） */
  sessionMinutes: number
  sessions: TemplateSession[]
  /** 套用该模板需要的器械，未勾选时会自动补进器械库 */
  requiredEquipmentIds: string[]
  /** 是否套用减负周（默认 true；冲击期模板为 false） */
  deload?: boolean
  /** 额外提示 */
  note?: string
}

/** 薄肌训练法共通说明（来自作者置顶评论） */
const THIN_MUSCLE_PRINCIPLE = [
  '「薄肌」指先把体脂控制在 10–18%，再谈力量与围度；体脂超过 20% 先减脂。',
  '重量是雕刻肌肉的工具，肌肉同样是重量的产物：既不无脑冲重量，也不永远轻重量。',
  '三大项（卧推 / 硬拉 / 深蹲）按计划的百分比执行，其余动作按自己的水平选重量。',
  '等级表会同时看体脂、体重和动作标准度，动作变形就不算完成，防止冲重量。',
  '大项的百分比以你自己的极限重量为基准，套用后可在每个动作里改成实际公斤数。',
]

const THIN_MUSCLE_SOURCE = '抖音 @努力的橙子（自律中）第148集《少年，欢迎你加入薄肌训练法》'

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'tpl_thin_muscle_stage1',
    name: '薄肌训练法 · 第一阶段 肌肥大',
    source: THIN_MUSCLE_SOURCE,
    summary: '每周 5 练 2 休，8–15 次 × 4 组的中高容量打基础，大项 70% 重量起步。',
    principle: THIN_MUSCLE_PRINCIPLE,
    tags: ['薄肌', '肌肥大', '每周 5 练', '第一阶段'],
    daysPerWeek: 5,
    sessionMinutes: 75,
    sessions: [
      {
        title: '第 1 天 · 胸（注意控制）',
        weekday: 0,
        focus: 'push',
        exercises: [
          { exerciseId: 'ex_bb_bench', sets: 4, reps: 8, weightPct: 70, note: '70% 重量' },
          { exerciseId: 'ex_bb_incline_bench', sets: 4, reps: 8 },
          { exerciseId: 'ex_db_incline_bench', sets: 4, reps: 10 },
          { exerciseId: 'ex_mach_peck_deck', sets: 4, reps: 10 },
        ],
      },
      {
        title: '第 2 天 · 背部',
        weekday: 1,
        focus: 'pull',
        exercises: [
          { exerciseId: 'ex_bb_row', sets: 4, reps: 10, note: '原计划为海豹划船' },
          { exerciseId: 'ex_mach_seated_row', sets: 4, reps: 10, note: '贴近身体、反手' },
          { exerciseId: 'ex_mach_closegrip_pulldown', sets: 4, reps: 11, note: '对握，拉到下巴 10～12 次' },
          { exerciseId: 'ex_mach_lat_pulldown', sets: 4, reps: 12, note: '反手，10～13 次' },
        ],
      },
      {
        title: '第 3 天 · 肩膀（注意控制）',
        weekday: 2,
        focus: 'push',
        exercises: [
          { exerciseId: 'ex_db_rear_fly', sets: 4, reps: 12 },
          { exerciseId: 'ex_mach_reverse_fly', sets: 4, reps: 11, note: '10～12 次' },
          { exerciseId: 'ex_db_lateral_raise', sets: 4, reps: 10, note: '上斜凳侧平举' },
          { exerciseId: 'ex_cable_lateral_raise', sets: 4, reps: 14, note: '12～15 次' },
        ],
      },
      {
        title: '第 4 天 · 胸 + 手臂（注意控制）',
        weekday: 4,
        focus: 'upper',
        exercises: [
          { exerciseId: 'ex_bb_bench', sets: 4, reps: 8, weightPct: 72.5, note: '极限的 72.5%' },
          { exerciseId: 'ex_db_hammer_curl', sets: 4, reps: 10, note: '锤式双手弯举' },
          { exerciseId: 'ex_bb_closegrip_bench', sets: 4, reps: 10, note: '原计划为上斜杠铃臂屈伸' },
          { exerciseId: 'ex_bb_curl', sets: 4, reps: 10 },
          { exerciseId: 'ex_cable_pushdown', sets: 4, reps: 10 },
        ],
      },
      {
        title: '第 5 天 · 腿 + 核心',
        weekday: 5,
        focus: 'legs',
        exercises: [
          { exerciseId: 'ex_bb_squat', sets: 4, reps: 8, weightPct: 70, note: '极限的 70%' },
          { exerciseId: 'ex_bb_rdl', sets: 4, reps: 8 },
          { exerciseId: 'ex_cable_crunch', sets: 4, reps: 12 },
          { exerciseId: 'ex_bw_crunch', sets: 4, reps: 14, note: '杠铃片卷腹，12～15 次，可抱片加重' },
        ],
      },
    ],
    requiredEquipmentIds: [
      'eq_bench',
      'eq_dumbbell',
      'eq_peckdeck',
      'eq_seatedrow',
      'eq_latpulldown',
      'eq_cable',
      'eq_squatrack',
      'eq_barbell',
      'eq_yogamat',
    ],
    note: '原计划节奏为「练 3 天 → 休 1 天 → 练 2 天 → 休 1 天」，已映射到周一 / 二 / 三 / 五 / 六。',
  },
  {
    id: 'tpl_thin_muscle_stage2',
    name: '薄肌训练法 · 第二阶段 增肌增力',
    source: THIN_MUSCLE_SOURCE,
    summary: '大项转为 3×3 的双组数（83% + 72.5%）波浪加重，辅助动作保持 10–12 次 × 4 组。',
    principle: [
      ...THIN_MUSCLE_PRINCIPLE,
      '大项一天做两组：先冲 83% 的 4×3，再用 72.5% 的 7×3 堆容量。',
      '超程硬拉从 65% 开始，每次训练加 5 公斤，直到动作变形为止。',
    ],
    tags: ['薄肌', '增肌增力', '3×3', '第二阶段'],
    daysPerWeek: 4,
    sessionMinutes: 75,
    sessions: [
      {
        title: '第 1 天 · 胸 + 肩中束',
        weekday: 0,
        focus: 'push',
        exercises: [
          { exerciseId: 'ex_bb_bench', sets: 3, reps: 4, weightPct: 83, note: '83%' },
          { exerciseId: 'ex_bb_bench', sets: 3, reps: 7, weightPct: 72.5, note: '72.5%，同一动作第二组数' },
          { exerciseId: 'ex_db_lateral_raise', sets: 4, reps: 11, note: '站姿，10～12 次' },
          { exerciseId: 'ex_cable_lateral_raise', sets: 4, reps: 11, note: '10～12 次' },
        ],
      },
      {
        title: '第 2 天 · 背部 + 肩后束',
        weekday: 1,
        focus: 'pull',
        exercises: [
          { exerciseId: 'ex_bb_deadlift', sets: 3, reps: 3, weightPct: 65, note: '超程硬拉，65% 起步每次 +5kg' },
          { exerciseId: 'ex_bb_row', sets: 4, reps: 10, note: '原计划为 T 杆划船' },
          { exerciseId: 'ex_mach_closegrip_pulldown', sets: 4, reps: 10, note: '对握' },
          { exerciseId: 'ex_db_rear_fly', sets: 4, reps: 12 },
          { exerciseId: 'ex_mach_reverse_fly', sets: 4, reps: 10 },
        ],
      },
      {
        title: '第 3 天 · 胸 + 手臂',
        weekday: 4,
        focus: 'upper',
        exercises: [
          { exerciseId: 'ex_bb_bench', sets: 3, reps: 4, weightPct: 84, note: '84%' },
          { exerciseId: 'ex_bb_bench', sets: 3, reps: 7, weightPct: 72.5, note: '72.5%' },
          { exerciseId: 'ex_db_hammer_curl', sets: 4, reps: 10, note: '锤式弯举' },
          { exerciseId: 'ex_bb_closegrip_bench', sets: 4, reps: 10, note: '原计划为上斜杠铃臂屈伸' },
          { exerciseId: 'ex_cable_pushdown', sets: 4, reps: 12 },
        ],
      },
      {
        title: '第 4 天 · 腿 + 核心',
        weekday: 5,
        focus: 'legs',
        exercises: [
          { exerciseId: 'ex_bb_squat', sets: 3, reps: 4, weightPct: 83, note: '83%' },
          { exerciseId: 'ex_bb_squat', sets: 3, reps: 7, weightPct: 72.5, note: '72.5%' },
          { exerciseId: 'ex_cable_crunch', sets: 4, reps: 15, note: '跪姿' },
          { exerciseId: 'ex_mach_lat_pulldown', sets: 4, reps: 12, note: '侧身高位下拉' },
        ],
      },
    ],
    requiredEquipmentIds: [
      'eq_bench',
      'eq_dumbbell',
      'eq_barbell',
      'eq_latpulldown',
      'eq_peckdeck',
      'eq_cable',
      'eq_squatrack',
      'eq_yogamat',
    ],
    note: '原计划节奏为「练 2 天 → 休 1 天 → 练 2 天 → 休 2 天」，已映射到周一 / 二 / 五 / 六。',
  },
  {
    id: 'tpl_thin_muscle_stage3',
    name: '薄肌训练法 · 第三阶段 冲击期',
    source: THIN_MUSCLE_SOURCE,
    summary: '大项拉到 90% 冲极限，总组数下降、强度拉满，适合已经跑完前两个阶段的人。',
    principle: [
      ...THIN_MUSCLE_PRINCIPLE,
      '冲击期用 90% + 78% 的双组数冲击新极限，组间休息拉长到 3 分钟。',
      '卧推极限按每周 +1.5% 的节奏爬升，动作变形立即停。',
    ],
    tags: ['薄肌', '冲击期', '90%', '第三阶段'],
    daysPerWeek: 4,
    sessionMinutes: 75,
    sessions: [
      {
        title: '第 1 天 · 胸',
        weekday: 0,
        focus: 'push',
        exercises: [
          { exerciseId: 'ex_bb_bench', sets: 3, reps: 2, weightPct: 90, note: '90%' },
          { exerciseId: 'ex_bb_bench', sets: 3, reps: 5, weightPct: 78, note: '78%' },
          { exerciseId: 'ex_db_incline_bench', sets: 3, reps: 8 },
          { exerciseId: 'ex_cable_lateral_raise', sets: 3, reps: 11, note: '坐姿侧平举，10～12 次' },
        ],
      },
      {
        title: '第 2 天 · 背部',
        weekday: 1,
        focus: 'pull',
        exercises: [
          { exerciseId: 'ex_bb_deadlift', sets: 3, reps: 3, note: '超程硬拉' },
          { exerciseId: 'ex_bb_row', sets: 4, reps: 10, note: '原计划为 T 型横杠开肘划船' },
          { exerciseId: 'ex_mach_closegrip_pulldown', sets: 4, reps: 10, note: '对握，拉到头发高度' },
          { exerciseId: 'ex_mach_reverse_fly', sets: 4, reps: 12 },
        ],
      },
      {
        title: '第 3 天 · 胸 + 手臂',
        weekday: 4,
        focus: 'upper',
        exercises: [
          { exerciseId: 'ex_bb_bench', sets: 3, reps: 2, weightPct: 90, note: '90%' },
          { exerciseId: 'ex_bb_bench', sets: 3, reps: 5, weightPct: 78, note: '78%' },
          { exerciseId: 'ex_bb_curl', sets: 4, reps: 10 },
          { exerciseId: 'ex_cable_pushdown', sets: 4, reps: 12 },
        ],
      },
      {
        title: '第 4 天 · 腿 + 核心',
        weekday: 5,
        focus: 'legs',
        exercises: [
          { exerciseId: 'ex_bb_squat', sets: 3, reps: 2, weightPct: 83, note: '83%' },
          { exerciseId: 'ex_bb_squat', sets: 3, reps: 5, weightPct: 78, note: '78%' },
          { exerciseId: 'ex_cable_crunch', sets: 4, reps: 15, note: '跪姿' },
          { exerciseId: 'ex_bw_russian_twist', sets: 4, reps: 12, note: '侧身卷腹下拉' },
        ],
      },
    ],
    requiredEquipmentIds: [
      'eq_bench',
      'eq_dumbbell',
      'eq_barbell',
      'eq_latpulldown',
      'eq_peckdeck',
      'eq_cable',
      'eq_squatrack',
      'eq_yogamat',
    ],
    note: '原计划节奏为「练 2 天 → 休 1 天 → 练 2 天 → 休 2 天」，已映射到周一 / 二 / 五 / 六。冲击期不设减负周。',
    deload: false,
  },
]

export function getTemplate(id: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((t) => t.id === id)
}
