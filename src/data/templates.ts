/**
 * 训练模板库
 * 模板 = 别人写好的固定处方：动作、组数、次数都按模板来；
 * 套用后仍然可以逐个动作改重量 / 组数 / 次数（引擎只负责给一个能直接执行的起点）。
 */

export interface TemplateExerciseItem {
  exerciseId: string
  /** 组数 */
  sets: number
  /** 每组次数；计时类为秒，有氧类为分钟 */
  reps: number
  /** 模板作者给的补充说明 */
  note?: string
}

export interface TemplateSession {
  /** 周内第几天（0 = 周一） */
  weekday: number
  title: string
  exercises: TemplateExerciseItem[]
}

export interface TemplateStage {
  id: string
  name: string
  summary: string
  note?: string
  /**
   * 强度百分比：以「按体重估算的起始重量」为 70% 基准换算。
   * 0.7 → 等于估算起始重量；0.9 → 估算值的 1.286 倍。
   */
  intensity: number
  /** 最后阶段为冲击期：末周不减负 */
  isPeak?: boolean
  sessions: TemplateSession[]
}

export interface PlanTemplate {
  id: string
  name: string
  /** 出处 */
  source: string
  summary: string
  /** 训练思路 */
  principle: string[]
  tags: string[]
  /** 每周训练天数（多阶段模板取第一阶段） */
  daysPerWeek: number
  /** 套用时会自动勾选的器械 */
  requiredEquipmentIds: string[]
  note?: string
  /** 单阶段模板的训练安排 */
  sessions?: TemplateSession[]
  /** 多阶段模板（每个阶段展开为一个中周期） */
  stages?: TemplateStage[]
}

/**
 * 薄肌训练法（三阶段 12 周）
 * 目标：低体脂 + 清晰线条，不追求围度。
 * 阶段一打基础定动作，阶段二加容量，阶段三上强度冲重量。
 */
const THIN_MUSCLE: PlanTemplate = {
  id: 'tpl_thin_muscle',
  name: '薄肌训练法',
  source: '按 @努力的橙子薄肌《少年，欢迎加入薄肌训练法》公开内容整理，重量与组数可按自身情况调整',
  summary:
    '12 周三阶段：基础期每周 5 练打底，增肌期每周 4 练加容量，冲击期上强度冲重量。轻重量、短间歇、慢离心，练线条不练围度。',
  principle: [
    '体脂是薄肌的前提：线条靠低体脂显出来，饮食控制优先于加重量',
    '中低重量 + 中高次数，短间歇（45–90 秒），保持代谢压力但不堆围度',
    '全程控制离心 2 秒、顶峰收缩 1 秒，不借惯性甩重量',
    '每个阶段最后一周减负，给关节和神经恢复空间',
    '力量训练后再做 15–20 分钟低强度有氧，保肌肉、刷脂肪',
  ],
  tags: ['薄肌', '低体脂', '线条', '12 周', '三阶段'],
  daysPerWeek: 5,
  requiredEquipmentIds: [
    'eq_bench',
    'eq_barbell',
    'eq_squatrack',
    'eq_dumbbell',
    'eq_cable',
    'eq_latpulldown',
    'eq_legpress',
    'eq_legcurl',
    'eq_pullupbar',
    'eq_elliptical',
    'eq_yogamat',
  ],
  note: '共 12 周（3 阶段 × 4 周），套用后按日期自动推进阶段。每个动作的重量、组数、次数都能在计划里直接改。',
  stages: [
    {
      id: 'stage1',
      name: '基础期 · 动作定型',
      summary: '每周 5 练，70% 强度。先把动作模式练熟，重量宁轻不求重。',
      intensity: 0.7,
      note: '前两周刻意留 2–3 次余力，重点感受目标肌肉发力。',
      sessions: [
        {
          weekday: 0,
          title: '胸 · 三头',
          exercises: [
            { exerciseId: 'ex_bb_bench', sets: 4, reps: 8, note: '主项，慢离心 2 秒' },
            { exerciseId: 'ex_db_incline_bench', sets: 3, reps: 10 },
            { exerciseId: 'ex_cable_fly', sets: 3, reps: 12 },
            { exerciseId: 'ex_cable_pushdown', sets: 3, reps: 12 },
            { exerciseId: 'ex_bw_crunch', sets: 3, reps: 15 },
          ],
        },
        {
          weekday: 1,
          title: '背 · 二头',
          exercises: [
            { exerciseId: 'ex_mach_lat_pulldown', sets: 4, reps: 10 },
            { exerciseId: 'ex_cable_row', sets: 4, reps: 10 },
            { exerciseId: 'ex_cable_face_pull', sets: 3, reps: 15, note: '改善圆肩，肩袖健康' },
            { exerciseId: 'ex_db_curl', sets: 3, reps: 12 },
            { exerciseId: 'ex_db_hammer_curl', sets: 3, reps: 12 },
          ],
        },
        {
          weekday: 2,
          title: '腿 · 臀',
          exercises: [
            { exerciseId: 'ex_bb_squat', sets: 4, reps: 8, note: '不追求大重量，动作到位即可' },
            { exerciseId: 'ex_db_rdl', sets: 4, reps: 10 },
            { exerciseId: 'ex_mach_leg_curl', sets: 3, reps: 12 },
            { exerciseId: 'ex_bw_glute_bridge', sets: 3, reps: 15 },
            { exerciseId: 'ex_bw_plank', sets: 3, reps: 40, note: '40 秒/组' },
          ],
        },
        {
          weekday: 3,
          title: '肩 · 核心',
          exercises: [
            { exerciseId: 'ex_db_shoulder_press', sets: 4, reps: 10 },
            { exerciseId: 'ex_db_lateral_raise', sets: 4, reps: 15, note: '撑肩宽，视觉显瘦' },
            { exerciseId: 'ex_cable_face_pull', sets: 3, reps: 15 },
            { exerciseId: 'ex_cable_crunch', sets: 3, reps: 15 },
            { exerciseId: 'ex_bw_lying_leg_raise', sets: 3, reps: 12 },
          ],
        },
        {
          weekday: 4,
          title: '弱项补强 · 有氧',
          exercises: [
            { exerciseId: 'ex_db_bench', sets: 3, reps: 10 },
            { exerciseId: 'ex_bw_pullup', sets: 3, reps: 8, note: '做不了就用高位下拉代替' },
            { exerciseId: 'ex_db_lateral_raise', sets: 3, reps: 15 },
            { exerciseId: 'ex_cable_crunch', sets: 3, reps: 15 },
            { exerciseId: 'ex_cardio_elliptical', sets: 1, reps: 20, note: '力量后 20 分钟低强度有氧' },
          ],
        },
      ],
    },
    {
      id: 'stage2',
      name: '增肌期 · 容量叠加',
      summary: '每周 4 练，80% 强度。组数和次数都往上加，把肌肉量垫起来。',
      intensity: 0.8,
      note: '这一阶段会有明显的泵感和延迟性酸痛，睡眠要跟上。',
      sessions: [
        {
          weekday: 0,
          title: '胸 · 肩 · 三头',
          exercises: [
            { exerciseId: 'ex_bb_bench', sets: 4, reps: 8 },
            { exerciseId: 'ex_db_incline_bench', sets: 4, reps: 10 },
            { exerciseId: 'ex_db_lateral_raise', sets: 4, reps: 15 },
            { exerciseId: 'ex_cable_pushdown', sets: 4, reps: 12 },
            { exerciseId: 'ex_bw_crunch', sets: 3, reps: 15 },
          ],
        },
        {
          weekday: 1,
          title: '背 · 二头',
          exercises: [
            { exerciseId: 'ex_mach_lat_pulldown', sets: 4, reps: 10 },
            { exerciseId: 'ex_cable_row', sets: 4, reps: 10 },
            { exerciseId: 'ex_bw_pullup', sets: 3, reps: 8 },
            { exerciseId: 'ex_db_curl', sets: 4, reps: 12 },
            { exerciseId: 'ex_cable_face_pull', sets: 3, reps: 15 },
          ],
        },
        {
          weekday: 2,
          title: '腿 · 臀',
          exercises: [
            { exerciseId: 'ex_bb_squat', sets: 4, reps: 8 },
            { exerciseId: 'ex_mach_leg_press', sets: 4, reps: 10 },
            { exerciseId: 'ex_db_rdl', sets: 4, reps: 10 },
            { exerciseId: 'ex_mach_leg_curl', sets: 4, reps: 12 },
            { exerciseId: 'ex_bw_plank', sets: 3, reps: 40, note: '40 秒/组' },
          ],
        },
        {
          weekday: 4,
          title: '肩 · 手臂 · 核心',
          exercises: [
            { exerciseId: 'ex_db_shoulder_press', sets: 4, reps: 10 },
            { exerciseId: 'ex_db_lateral_raise', sets: 4, reps: 15 },
            { exerciseId: 'ex_cable_face_pull', sets: 4, reps: 15 },
            { exerciseId: 'ex_db_hammer_curl', sets: 3, reps: 12 },
            { exerciseId: 'ex_cable_crunch', sets: 3, reps: 15 },
          ],
        },
      ],
    },
    {
      id: 'stage3',
      name: '冲击期 · 强度冲刺',
      summary: '每周 4 练，90% 强度。组数收、重量上，冲一波力量，最后一周做测试。',
      intensity: 0.9,
      isPeak: true,
      note: '最后一周可以尝试冲击新重量，务必有人保护或有安全架。',
      sessions: [
        {
          weekday: 0,
          title: '胸 · 三头',
          exercises: [
            { exerciseId: 'ex_bb_bench', sets: 5, reps: 5 },
            { exerciseId: 'ex_db_incline_bench', sets: 3, reps: 8 },
            { exerciseId: 'ex_cable_fly', sets: 3, reps: 10 },
            { exerciseId: 'ex_cable_pushdown', sets: 3, reps: 10 },
            { exerciseId: 'ex_bw_crunch', sets: 3, reps: 15 },
          ],
        },
        {
          weekday: 1,
          title: '背 · 二头',
          exercises: [
            { exerciseId: 'ex_mach_lat_pulldown', sets: 4, reps: 8 },
            { exerciseId: 'ex_cable_row', sets: 4, reps: 8 },
            { exerciseId: 'ex_bw_pullup', sets: 3, reps: 6 },
            { exerciseId: 'ex_db_curl', sets: 3, reps: 10 },
            { exerciseId: 'ex_cable_face_pull', sets: 3, reps: 12 },
          ],
        },
        {
          weekday: 2,
          title: '腿 · 臀',
          exercises: [
            { exerciseId: 'ex_bb_squat', sets: 5, reps: 5 },
            { exerciseId: 'ex_db_rdl', sets: 3, reps: 8 },
            { exerciseId: 'ex_mach_leg_curl', sets: 3, reps: 10 },
            { exerciseId: 'ex_bw_glute_bridge', sets: 3, reps: 12 },
            { exerciseId: 'ex_bw_plank', sets: 3, reps: 40, note: '40 秒/组' },
          ],
        },
        {
          weekday: 4,
          title: '肩 · 核心',
          exercises: [
            { exerciseId: 'ex_db_shoulder_press', sets: 4, reps: 8 },
            { exerciseId: 'ex_db_lateral_raise', sets: 3, reps: 12 },
            { exerciseId: 'ex_cable_face_pull', sets: 3, reps: 12 },
            { exerciseId: 'ex_cable_crunch', sets: 3, reps: 12 },
            { exerciseId: 'ex_bw_lying_leg_raise', sets: 3, reps: 12 },
          ],
        },
      ],
    },
  ],
}

export const PLAN_TEMPLATES: PlanTemplate[] = [THIN_MUSCLE]

export function getTemplate(id: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((t) => t.id === id)
}
