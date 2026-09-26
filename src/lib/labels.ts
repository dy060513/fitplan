import type {
  BodyRegion,
  Completion,
  EquipmentCategory,
  EquipmentPreference,
  Experience,
  Gender,
  Goal,
  MuscleEmphasis,
  MuscleGroup,
  MovementPattern,
  TrainingRhythm,
} from '@/types'

export const GENDER_LABEL: Record<Gender, string> = {
  male: '男',
  female: '女',
  other: '不便透露',
}

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  novice: '新手（0–3 个月）',
  beginner: '初级（3–12 个月）',
  intermediate: '中级（1–3 年）',
}

export const EXPERIENCE_SHORT: Record<Experience, string> = {
  novice: '新手',
  beginner: '初级',
  intermediate: '中级',
}

export const GOAL_LABEL: Record<Goal, string> = {
  muscle: '增肌',
  fatloss: '减脂',
  strength: '增力',
  toning: '塑形',
  health: '保持健康',
}

export const GOAL_DESC: Record<Goal, string> = {
  muscle: '中等次数、中短间歇，追求肌肉体积增长',
  fatloss: '高次数、短间歇，配合有氧消耗热量',
  strength: '低次数、长间歇，追求力量提升',
  toning: '中高次数、短间歇，塑造线条',
  health: '低容量、低强度，养成规律运动习惯',
}

export const BODY_REGION_LABEL: Record<BodyRegion, string> = {
  neck: '颈',
  shoulder: '肩',
  lowerBack: '腰',
  knee: '膝',
  wrist: '腕',
}

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: '胸',
  back: '背',
  shoulders: '肩',
  biceps: '肱二头',
  triceps: '肱三头',
  quads: '大腿前侧',
  hamstrings: '大腿后侧',
  glutes: '臀',
  calves: '小腿',
  core: '核心',
  cardio: '有氧',
}

export const PATTERN_LABEL: Record<MovementPattern | 'full' | 'upper' | 'lower' | 'weakpoint', string> =
  {
    push: '推',
    pull: '拉',
    legs: '腿',
    core: '核心',
    cardio: '有氧',
    full: '全身',
    upper: '上肢',
    lower: '下肢',
    weakpoint: '弱项',
  }

export const EQUIPMENT_CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  free: '自由重量',
  machine: '固定器械',
  cardio: '有氧',
  bodyweight: '自重 / 辅具',
}

export const COMPLETION_LABEL: Record<Completion, string> = {
  all: '全部完成',
  partial: '部分完成',
  none: '未完成',
}

export const WEEKDAY_LABEL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']

export const RHYTHM_LABEL: Record<TrainingRhythm, string> = {
  consecutive: '连着练',
  rest1: '练一休一',
  rest2: '练二休一',
  custom: '自定义星期',
}

export const RHYTHM_DESC: Record<TrainingRhythm, string> = {
  consecutive: '训练日排在一起，休息日集中在周中或周末',
  rest1: '练一天休一天，恢复最充分（每周最多 4 练）',
  rest2: '连练两天休一天（每周最多 5 练）',
  custom: '自己指定每周哪几天训练',
}

export const EQUIPMENT_PREFERENCE_LABEL: Record<EquipmentPreference, string> = {
  free: '偏好自由重量',
  machine: '偏好固定器械',
  any: '不限',
}

export const MUSCLE_EMPHASIS_LABEL: Record<MuscleEmphasis, string> = {
  none: '不练',
  less: '少练',
  normal: '正常',
  more: '加强',
}

export const MUSCLE_EMPHASIS_DESC =
  '不想练的部位设为「少练」（每次最多 1 个动作）或「不练」（完全不排）；想重点突破的设为「加强」。'

export const EQUIPMENT_PREFERENCE_DESC: Record<EquipmentPreference, string> = {
  free: '优先排哑铃 / 杠铃类动作，自由度高、刺激更全面',
  machine: '优先排固定器械，轨迹稳定、上手更安全',
  any: '由系统按动作质量自动挑选，不作倾向',
}

export const PAIN_LEVEL_LABEL: Record<1 | 2 | 3, string> = {
  1: '轻微（能忍受）',
  2: '明显（影响动作）',
  3: '剧烈（无法继续）',
}

export const DISCLAIMER =
  '本应用给出的计划与建议基于通用训练原则自动生成，不构成医疗建议、诊断或治疗方案。'

export const MEDICAL_FLAGS = ['高血压 / 心血管问题', '糖尿病', '骨关节术后', '孕期 / 产后', '其他慢性病']

/** 需要提示先咨询医生的健康情况 */
export function needsDoctorNotice(profile: { age: number; medicalFlags: string[]; injuries: string[] }): boolean {
  return profile.age >= 45 || profile.medicalFlags.length > 0 || profile.injuries.length > 0
}
