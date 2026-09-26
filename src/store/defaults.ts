import type { AppState, Equipment, Exercise, MuscleGroup, MovementPattern } from '@/types'
import { PRESET_EQUIPMENT } from '@/data/equipment'
import { PRESET_EXERCISES } from '@/data/exercises'

export const STORAGE_KEY = 'fitplan.state.v1'
export const STATE_VERSION = 1

const FIXED_TS = '2026-01-01T00:00:00.000Z'

export function initialState(): AppState {
  return {
    version: STATE_VERSION,
    user: null,
    profile: null,
    equipment: PRESET_EQUIPMENT.map((e) => ({ ...e, createdAt: e.createdAt || FIXED_TS })),
    selectedEquipmentIds: [],
    exercises: PRESET_EXERCISES,
    plan: null,
    sessions: [],
    progress: {},
    settings: { theme: 'dark', mesocycleWeeks: 4, unit: 'kg' },
  }
}

export function patternFromMuscleGroup(g: MuscleGroup): MovementPattern {
  switch (g) {
    case 'chest':
    case 'shoulders':
    case 'triceps':
      return 'push'
    case 'back':
    case 'biceps':
      return 'pull'
    case 'quads':
    case 'hamstrings':
    case 'glutes':
    case 'calves':
      return 'legs'
    case 'core':
      return 'core'
    default:
      return 'cardio'
  }
}

/** 自定义器械 → 派生一个可执行动作，保证「计划动作均来自已勾选器械」仍然成立 */
export function makeExerciseForCustomEquipment(eq: Equipment, muscleGroup: MuscleGroup): Exercise {
  const isCardio = eq.category === 'cardio'
  return {
    id: `ex_custom_${eq.id}`,
    name: eq.name,
    equipmentId: eq.id,
    muscleGroup,
    secondaryMuscles: [],
    pattern: patternFromMuscleGroup(muscleGroup),
    level: 'beginner',
    compound: !isCardio,
    riskRegions: [],
    loadType: isCardio ? 'cardio' : 'machine',
    loadFactor: isCardio ? 0 : 0.25,
    cardioMinutes: isCardio ? 10 : undefined,
    cues: [
      '首次使用请先熟悉器械行程，从最小重量开始。',
      '动作过程中如关节出现刺痛，请立即停止并更换动作。',
    ],
    restSeconds: isCardio ? 0 : 60,
    alternatives: [],
    isCustom: true,
  }
}
