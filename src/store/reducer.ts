import type {
  AppSettings,
  AppState,
  Equipment,
  EquipmentCategory,
  Feedback,
  MuscleGroup,
  Plan,
  PlanExercise,
  PlanSession,
  Profile,
  User,
  WeightLog,
  WorkoutSession,
  WorkoutSet,
} from '@/types'
import { initialState, makeExerciseForCustomEquipment } from './defaults'
import { generatePlan, prescribeExercise } from '@/engine/generate'
import { expandTemplate } from '@/engine/template'
import { getTemplate } from '@/data/templates'
import { applyFeedback, buildFeedback } from '@/engine/progression'
import { uid, todayISO } from '@/lib/utils'

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'reset' }
  | { type: 'acceptDisclaimer' }
  | { type: 'setSettings'; patch: Partial<AppSettings> }
  | {
      type: 'completeOnboarding'
      profile: Omit<Profile, 'id' | 'userId' | 'updatedAt' | 'weightLogs'> & { weightLogs?: WeightLog[] }
      selectedEquipmentIds: string[]
    }
  | { type: 'saveProfile'; patch: Partial<Profile> }
  | { type: 'addWeightLog'; kg: number; date?: string }
  | { type: 'removeWeightLog'; id: string }
  | { type: 'setEquipmentSelection'; ids: string[] }
  | { type: 'addCustomEquipment'; name: string; category: EquipmentCategory; muscleGroup: MuscleGroup; weightRange?: Equipment['weightRange'] }
  | { type: 'removeCustomEquipment'; id: string }
  | { type: 'generatePlan'; startDate?: string }
  | { type: 'applyTemplate'; templateId: string; startDate?: string }
  | { type: 'replacePlanExercise'; planSessionId: string; planExerciseId: string; exerciseId: string }
  | {
      type: 'updatePlanExercise'
      planSessionId: string
      planExerciseId: string
      patch: Partial<Pick<PlanExercise, 'sets' | 'reps' | 'suggestedWeightKg' | 'restSeconds'>>
    }
  | { type: 'addPlanExercise'; planSessionId: string; exerciseId: string }
  | { type: 'removePlanExercise'; planSessionId: string; planExerciseId: string }
  | { type: 'markSessionStatus'; planSessionId: string; status: PlanSession['status'] }
  | { type: 'startSession'; planSessionId?: string; title: string; focus?: string }
  | { type: 'upsertSet'; sessionId: string; set: WorkoutSet }
  | { type: 'removeSet'; sessionId: string; setId: string }
  | { type: 'finishSession'; sessionId: string; feedback: Omit<Feedback, 'id' | 'createdAt' | 'sessionId' | 'adjustments' | 'advice'>; durationMinutes: number }
  | { type: 'discardSession'; sessionId: string }
  | { type: 'importState'; state: AppState }

function ensureUser(state: AppState): User {
  return (
    state.user ?? {
      id: uid('user'),
      createdAt: new Date().toISOString(),
      onboarded: false,
    }
  )
}

function emptyProfile(userId: string): Profile {
  return {
    id: uid('profile'),
    userId,
    updatedAt: new Date().toISOString(),
    heightCm: 170,
    weightKg: 65,
    age: 25,
    gender: 'male',
    experience: 'novice',
    goal: 'muscle',
    daysPerWeek: 3,
    sessionMinutes: 45,
    injuries: [],
    medicalFlags: [],
    weightLogs: [],
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state

    case 'reset':
      return initialState()

    case 'acceptDisclaimer': {
      const user = ensureUser(state)
      return { ...state, user: { ...user, disclaimerAcceptedAt: new Date().toISOString() } }
    }

    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'completeOnboarding': {
      const user = { ...ensureUser(state), onboarded: true, disclaimerAcceptedAt: new Date().toISOString() }
      const profile: Profile = {
        ...emptyProfile(user.id),
        ...action.profile,
        updatedAt: new Date().toISOString(),
        weightLogs: action.profile.weightLogs ?? [
          { id: uid('w'), date: todayISO(), kg: action.profile.weightKg },
        ],
      }
      return {
        ...state,
        user,
        profile,
        selectedEquipmentIds: action.selectedEquipmentIds,
        sessions: state.sessions,
      }
    }

    case 'saveProfile': {
      if (!state.profile) return state
      const merged: Profile = { ...state.profile, ...action.patch, updatedAt: new Date().toISOString() }
      // 体重变化时同步写入趋势记录
      if (action.patch.weightKg !== undefined) {
        const today = todayISO()
        const exists = merged.weightLogs.find((w) => w.date === today)
        if (exists) {
          merged.weightLogs = merged.weightLogs.map((w) => (w.date === today ? { ...w, kg: action.patch.weightKg! } : w))
        } else {
          merged.weightLogs = [...merged.weightLogs, { id: uid('w'), date: today, kg: action.patch.weightKg }]
        }
      }
      return { ...state, profile: merged }
    }

    case 'addWeightLog': {
      if (!state.profile) return state
      const date = action.date ?? todayISO()
      const logs = state.profile.weightLogs.filter((w) => w.date !== date)
      logs.push({ id: uid('w'), date, kg: action.kg })
      logs.sort((a, b) => a.date.localeCompare(b.date))
      const profile: Profile = {
        ...state.profile,
        weightKg: action.kg,
        weightLogs: logs,
        updatedAt: new Date().toISOString(),
      }
      return { ...state, profile }
    }

    case 'removeWeightLog': {
      if (!state.profile) return state
      return {
        ...state,
        profile: { ...state.profile, weightLogs: state.profile.weightLogs.filter((w) => w.id !== action.id) },
      }
    }

    case 'setEquipmentSelection':
      return { ...state, selectedEquipmentIds: action.ids }

    case 'addCustomEquipment': {
      const id = uid('eq')
      const eq: Equipment = {
        id,
        name: action.name,
        category: action.category,
        weightRange: action.weightRange,
        custom: true,
        createdAt: new Date().toISOString(),
      }
      const derived = makeExerciseForCustomEquipment(eq, action.muscleGroup)
      return {
        ...state,
        equipment: [...state.equipment, eq],
        exercises: [...state.exercises, derived],
        selectedEquipmentIds: state.selectedEquipmentIds.includes(id)
          ? state.selectedEquipmentIds
          : [...state.selectedEquipmentIds, id],
      }
    }

    case 'removeCustomEquipment': {
      return {
        ...state,
        equipment: state.equipment.filter((e) => !(e.id === action.id && e.custom)),
        exercises: state.exercises.filter((e) => e.equipmentId !== action.id || !e.isCustom),
        selectedEquipmentIds: state.selectedEquipmentIds.filter((i) => i !== action.id),
      }
    }

    case 'generatePlan': {
      if (!state.profile || !state.user) return state
      const plan = generatePlan({
        userId: state.user.id,
        profile: state.profile,
        exercises: state.exercises,
        equipment: state.equipment,
        selectedEquipmentIds: state.selectedEquipmentIds,
        mesocycleWeeks: state.settings.mesocycleWeeks,
        progress: state.progress,
        startDateISO: action.startDate ?? todayISO(),
      })
      return { ...state, plan }
    }

    case 'applyTemplate': {
      if (!state.profile || !state.user) return state
      const template = getTemplate(action.templateId)
      if (!template) return state
      const result = expandTemplate({
        template,
        userId: state.user.id,
        profile: state.profile,
        exercises: state.exercises,
        selectedEquipmentIds: state.selectedEquipmentIds,
        mesocycleWeeks: state.settings.mesocycleWeeks,
        progress: state.progress,
        startDateISO: action.startDate ?? todayISO(),
      })
      return {
        ...state,
        selectedEquipmentIds: result.addedEquipmentIds.length
          ? [...new Set([...state.selectedEquipmentIds, ...result.addedEquipmentIds])]
          : state.selectedEquipmentIds,
        plan: result.plan,
      }
    }

    case 'replacePlanExercise': {
      if (!state.plan) return state
      const exercise = state.exercises.find((e) => e.id === action.exerciseId)
      if (!exercise) return state
      const weeks = state.plan.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((s) => {
          if (s.id !== action.planSessionId) return s
          return {
            ...s,
            exercises: s.exercises.map((pe) =>
              pe.id === action.planExerciseId
                ? { ...pe, exerciseId: action.exerciseId, cues: exercise.cues, reason: '已手动替换为同肌群替代动作' }
                : pe,
            ),
          }
        }),
      }))
      return { ...state, plan: { ...state.plan, weeks, updatedAt: new Date().toISOString() } }
    }

    case 'updatePlanExercise': {
      if (!state.plan) return state
      const weeks = state.plan.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((s) => {
          if (s.id !== action.planSessionId) return s
          return {
            ...s,
            exercises: s.exercises.map((pe) =>
              pe.id === action.planExerciseId
                ? {
                    ...pe,
                    ...action.patch,
                    reason: '已手动调整，后续按此数值执行',
                  }
                : pe,
            ),
          }
        }),
      }))
      return { ...state, plan: { ...state.plan, weeks, updatedAt: new Date().toISOString() } }
    }

    case 'addPlanExercise': {
      if (!state.plan || !state.profile) return state
      const exercise = state.exercises.find((e) => e.id === action.exerciseId)
      if (!exercise) return state
      const rx = prescribeExercise(exercise, state.profile, state.progress[exercise.id], {})
      const weeks = state.plan.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((s) => {
          if (s.id !== action.planSessionId) return s
          return {
            ...s,
            exercises: [
              ...s.exercises,
              {
                id: uid('pex'),
                exerciseId: exercise.id,
                kind: 'main' as const,
                order: s.exercises.length,
                sets: rx.sets,
                reps: rx.reps,
                restSeconds: rx.restSeconds,
                suggestedWeightKg: rx.weightKg,
                cues: exercise.cues,
                reason: '手动新增动作',
              },
            ],
          }
        }),
      }))
      return { ...state, plan: { ...state.plan, weeks, updatedAt: new Date().toISOString() } }
    }

    case 'removePlanExercise': {
      if (!state.plan) return state
      const weeks = state.plan.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((s) => {
          if (s.id !== action.planSessionId) return s
          return {
            ...s,
            exercises: s.exercises
              .filter((pe) => pe.id !== action.planExerciseId)
              .map((pe, i) => ({ ...pe, order: i })),
          }
        }),
      }))
      return { ...state, plan: { ...state.plan, weeks, updatedAt: new Date().toISOString() } }
    }

    case 'markSessionStatus': {
      if (!state.plan) return state
      const weeks = state.plan.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((s) => (s.id === action.planSessionId ? { ...s, status: action.status } : s)),
      }))
      return { ...state, plan: { ...state.plan, weeks, updatedAt: new Date().toISOString() } }
    }

    case 'startSession': {
      if (!state.user || !state.profile) return state
      // 已有进行中的训练则直接复用
      const existing = state.sessions.find((s) => s.status === 'in-progress')
      if (existing) return state

      const planSession = action.planSessionId
        ? state.plan?.weeks.flatMap((w) => w.sessions).find((s) => s.id === action.planSessionId)
        : undefined

      const sets: WorkoutSet[] = (planSession?.exercises ?? []).flatMap((pe) =>
        Array.from({ length: pe.sets }, (_, i) => ({
          id: uid('set'),
          sessionId: '',
          planExerciseId: pe.id,
          exerciseId: pe.exerciseId,
          setIndex: i,
          targetReps: pe.reps,
          reps: pe.reps,
          weightKg: pe.suggestedWeightKg,
          done: false,
          createdAt: new Date().toISOString(),
        })),
      )

      const session: WorkoutSession = {
        id: uid('ses'),
        userId: state.user.id,
        planId: state.plan?.id,
        planSessionId: action.planSessionId,
        date: todayISO(),
        startedAt: new Date().toISOString(),
        title: action.title,
        focus: action.focus,
        sets: sets.map((s) => ({ ...s, sessionId: '' })),
        status: 'in-progress',
      }
      session.sets = session.sets.map((s) => ({ ...s, sessionId: session.id }))

      return { ...state, sessions: [session, ...state.sessions] }
    }

    case 'upsertSet': {
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId
            ? { ...s, sets: s.sets.map((x) => (x.id === action.set.id ? action.set : x)) }
            : s,
        ),
      }
    }

    case 'removeSet': {
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId ? { ...s, sets: s.sets.filter((x) => x.id !== action.setId) } : s,
        ),
      }
    }

    case 'finishSession': {
      const target = state.sessions.find((s) => s.id === action.sessionId)
      if (!target || !state.profile || !state.plan) return state

      const exercisesById = Object.fromEntries(state.exercises.map((e) => [e.id, e]))

      const result = applyFeedback({
        plan: state.plan,
        profile: state.profile,
        exercisesById,
        allExercises: state.exercises,
        selectedEquipmentIds: state.selectedEquipmentIds,
        progress: state.progress,
        session: { id: target.id, date: target.date, sets: target.sets },
        feedback: action.feedback,
      })

      const feedback = buildFeedback(target.id, action.feedback, result.adjustments, result.advice)

      const sessions = state.sessions.map((s) =>
        s.id === action.sessionId
          ? { ...s, status: 'completed' as const, finishedAt: new Date().toISOString(), durationMinutes: action.durationMinutes, feedback }
          : s,
      )

      // 同步把计划内对应训练标记为已完成
      const plan: Plan = target.planSessionId
        ? {
            ...result.plan,
            weeks: result.plan.weeks.map((w) => ({
              ...w,
              sessions: w.sessions.map((x) => (x.id === target.planSessionId ? { ...x, status: 'done' as const } : x)),
            })),
          }
        : result.plan

      return { ...state, sessions, plan, progress: result.progress }
    }

    case 'discardSession':
      return { ...state, sessions: state.sessions.filter((s) => s.id !== action.sessionId) }

    case 'importState':
      return action.state

    default:
      return state
  }
}
