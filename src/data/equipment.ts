import type { Equipment, EquipmentCategory } from '@/types'
import { EXTRA_EQUIPMENT } from './equipment-extra'

export const EQUIPMENT_CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  free: '自由重量',
  machine: '固定器械',
  cardio: '有氧',
  bodyweight: '自重 / 辅具',
}

export const EQUIPMENT_CATEGORY_ORDER: EquipmentCategory[] = [
  'free',
  'machine',
  'cardio',
  'bodyweight',
]

/**
 * 预置器械库。
 * 说明：卧推架 / 深蹲架按「可完成杠铃卧推类 / 杠铃深蹲类动作」理解，
 * 因此动作的依赖器械只需要一个，保证「计划动作必定来自已勾选器械」这一硬约束可校验。
 */
const BASE_EQUIPMENT: Equipment[] = [
  // 自由重量
  { id: 'eq_dumbbell', name: '哑铃', category: 'free', weightRange: { min: 1, max: 40, step: 1 }, custom: false, createdAt: '' },
  { id: 'eq_barbell', name: '杠铃', category: 'free', weightRange: { min: 20, max: 150, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_kettlebell', name: '壶铃', category: 'free', weightRange: { min: 4, max: 40, step: 2 }, custom: false, createdAt: '' },
  { id: 'eq_bench', name: '卧推架', category: 'free', weightRange: { min: 20, max: 150, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_squatrack', name: '深蹲架', category: 'free', weightRange: { min: 20, max: 200, step: 2.5 }, custom: false, createdAt: '' },

  // 固定器械
  { id: 'eq_chestpress', name: '器械推胸', category: 'machine', weightRange: { min: 5, max: 100, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_latpulldown', name: '高位下拉', category: 'machine', weightRange: { min: 5, max: 100, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_seatedrow', name: '坐姿划船', category: 'machine', weightRange: { min: 5, max: 100, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_legpress', name: '腿举', category: 'machine', weightRange: { min: 20, max: 300, step: 5 }, custom: false, createdAt: '' },
  { id: 'eq_legext', name: '腿屈伸', category: 'machine', weightRange: { min: 5, max: 80, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_legcurl', name: '腿弯举', category: 'machine', weightRange: { min: 5, max: 80, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_peckdeck', name: '蝴蝶机', category: 'machine', weightRange: { min: 5, max: 80, step: 2.5 }, custom: false, createdAt: '' },
  { id: 'eq_cable', name: '绳索龙门架', category: 'machine', weightRange: { min: 2.5, max: 80, step: 2.5 }, custom: false, createdAt: '' },

  // 有氧
  { id: 'eq_treadmill', name: '跑步机', category: 'cardio', custom: false, createdAt: '' },
  { id: 'eq_elliptical', name: '椭圆机', category: 'cardio', custom: false, createdAt: '' },
  { id: 'eq_rower', name: '划船机', category: 'cardio', custom: false, createdAt: '' },
  { id: 'eq_spinbike', name: '动感单车', category: 'cardio', custom: false, createdAt: '' },

  // 自重 / 辅具
  { id: 'eq_pullupbar', name: '引体向上架', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_dipbar', name: '双杠臂屈伸架', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_yogamat', name: '瑜伽垫', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_band', name: '弹力带', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_swissball', name: '瑜伽球', category: 'bodyweight', custom: false, createdAt: '' },
  { id: 'eq_jumprope', name: '跳绳', category: 'bodyweight', custom: false, createdAt: '' },
]

/**
 * 完整预置器械库 = 基础库 + 扩充库
 * 按分类归并，保证界面分组内顺序稳定。
 */
export const PRESET_EQUIPMENT: Equipment[] = EQUIPMENT_CATEGORY_ORDER.flatMap((category) => [
  ...BASE_EQUIPMENT.filter((e) => e.category === category),
  ...EXTRA_EQUIPMENT.filter((e) => e.category === category),
])

/** 新手默认勾选的一组器械（首次建档时作为推荐） */
export const RECOMMENDED_EQUIPMENT_IDS = [
  'eq_dumbbell',
  'eq_barbell',
  'eq_bench',
  'eq_squatrack',
  'eq_latpulldown',
  'eq_legpress',
  'eq_yogamat',
]
