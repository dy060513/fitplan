import type { Equipment } from '@/types'

/**
 * 扩充器械库（第二批）
 * 与 equipment.ts 的预置库合并后作为完整器械列表
 */
export const EXTRA_EQUIPMENT: Equipment[] = [
  /* --------------------------- 自由重量 --------------------------- */
  { id: 'eq_smith', name: '史密斯机', category: 'free', weightRange: { min: 20, max: 200, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_ezbar', name: 'EZ 杠', category: 'free', weightRange: { min: 10, max: 60, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_hexbar', name: '六角杠 / 陷阱杠', category: 'free', weightRange: { min: 20, max: 200, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_romanchair', name: '罗马椅 / 背屈伸架', category: 'free', custom: false, createdAt: '' },
  { id: 'eq_abbench', name: '腹肌板 / 斜板', category: 'free', custom: false, createdAt: '' },
  { id: 'eq_preacher', name: '牧师凳', category: 'free', weightRange: { min: 10, max: 50, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_landmine', name: '地雷架 / T 杠架', category: 'free', weightRange: { min: 20, max: 120, step: 2.5 }, custom: false, createdAt: '' },

  /* --------------------------- 固定器械 --------------------------- */
  { id: 'eq_hacksquat', name: '哈克深蹲机', category: 'machine', weightRange: { min: 20, max: 300, step: 5 }, custom: false, createdAt: '' },
  { id: 'eq_hipthrust_mach', name: '臀推机', category: 'machine', weightRange: { min: 20, max: 200, step: 5 }, custom: false, createdAt: '' },
  { id: 'eq_abductor', name: '髋外展机', category: 'machine', weightRange: { min: 5, max: 100, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_adductor', name: '髋内收机', category: 'machine', weightRange: { min: 5, max: 100, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_calf_mach', name: '提踵机', category: 'machine', weightRange: { min: 10, max: 150, step: 5 }, custom: false, createdAt: '' },
  { id: 'eq_ab_mach', name: '卷腹机', category: 'machine', weightRange: { min: 5, max: 80, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_lateral_mach', name: '侧平举机', category: 'machine', weightRange: { min: 5, max: 50, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_glute_kickback', name: '后踢腿机', category: 'machine', weightRange: { min: 5, max: 100, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_torso_rotation', name: '转体训练机', category: 'machine', weightRange: { min: 5, max: 80, step: 2.5 }, custom: false, createdAt: '' },

  /* ----------------------------- 有氧 ----------------------------- */
  { id: 'eq_stairmill', name: '楼梯机', category: 'cardio', custom: false, createdAt: '' },
  { id: 'eq_airbike', name: '风阻单车', category: 'cardio', custom: false, createdAt: '' },
  { id: 'eq_skierg', name: '滑雪机', category: 'cardio', custom: false, createdAt: '' },

  /* ------------------------- 自重 / 辅具 ------------------------- */
  { id: 'eq_trx', name: '悬挂训练带（TRX）', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_medball', name: '药球', category: 'bodyweight', weightRange: { min: 2, max: 15, step: 1 }, custom: false, createdAt: '' },
  { id: 'eq_foamroller', name: '泡沫轴', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_abwheel', name: '健腹轮', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_step', name: '踏板 / 跳箱', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_battlerope', name: '战绳', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_weightvest', name: '负重背心', category: 'bodyweight', weightRange: { min: 2, max: 30, step: 1 }, custom: false, createdAt: '' },
]
