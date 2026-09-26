import { useState } from 'react'
import type { BodyRegion, Experience, ExerciseProgress, Gender, Goal, Profile } from '@/types'
import {
  BODY_REGION_LABEL,
  EXPERIENCE_LABEL,
  GENDER_LABEL,
  GOAL_DESC,
  GOAL_LABEL,
  MEDICAL_FLAGS,
} from '@/lib/labels'
import { Button, Card, Chip, DisclaimerBar, Field, NumberInput } from './ui'
import { TagMultiSelect } from './interactions'
import { EquipmentPicker } from './EquipmentPicker'
import { PreferenceEditor } from './PreferenceEditor'
import { useApp } from '@/store/AppContext'
import { RECOMMENDED_EQUIPMENT_IDS } from '@/data/equipment'
import { suggestWeekdays } from '@/engine/split'
import { STRENGTH_TEST_EXERCISE_IDS, estimateExperience, epley1RM, type StrengthLiftInput } from '@/engine/load'

const STEPS = ['身体数据', '训练经验与目标', '可投入时间', '训练节奏', '选择器械']

type Draft = Pick<
  Profile,
  | 'heightCm'
  | 'weightKg'
  | 'age'
  | 'gender'
  | 'experience'
  | 'goal'
  | 'daysPerWeek'
  | 'sessionMinutes'
  | 'injuries'
  | 'medicalFlags'
  | 'trainingRhythm'
  | 'customWeekdays'
  | 'cardioWeekdays'
  | 'equipmentPreference'
  | 'muscleEmphasis'
  | 'volume'
>

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useApp()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>({
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
    trainingRhythm: 'rest1',
    customWeekdays: [],
    cardioWeekdays: [],
    equipmentPreference: 'any',
    muscleEmphasis: {},
    volume: {},
  })
  const [selected, setSelected] = useState<string[]>(RECOMMENDED_EQUIPMENT_IDS)
  const [lifts, setLifts] = useState<StrengthLiftInput[]>([
    { exerciseId: 'ex_bb_bench', weightKg: 0, reps: 0 },
  ])

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  const weekdays = suggestWeekdays(draft.daysPerWeek, draft.trainingRhythm ?? 'consecutive', draft.customWeekdays ?? [])

  const validLifts = lifts.filter((l) => l.weightKg > 0 && l.reps > 0)
  const estimated = estimateExperience(validLifts, draft.weightKg, draft.gender)

  const finish = () => {
    const now = new Date().toISOString()
    const seed: Record<string, ExerciseProgress> = {}
    for (const l of validLifts) {
      seed[l.exerciseId] = {
        exerciseId: l.exerciseId,
        history: [],
        currentWeightKg: l.weightKg,
        currentReps: l.reps,
        easyStreak: 0,
        updatedAt: now,
      }
    }
    dispatch({
      type: 'completeOnboarding',
      profile: draft,
      selectedEquipmentIds: selected,
      progressSeed: Object.keys(seed).length ? seed : undefined,
    })
    dispatch({ type: 'generatePlan' })
    onDone()
  }

  const canNext = (() => {
    if (step === 0) return draft.heightCm > 80 && draft.weightKg > 20 && draft.age >= 12
    if (step === 3) return weekdays.length >= 1
    if (step === 4) return selected.length >= 2
    return true
  })()

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-28 pt-6 dark:bg-[#0b0f14]">
      <div className="mx-auto max-w-md">
        <header className="mb-5">
          <h1 className="text-[22px] font-bold tracking-tight">欢迎使用 FitPlan</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            5 步生成属于你的训练计划，全部数据保存在本机
          </p>
        </header>

        <div className="mb-4 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-800'}`}
              />
              <p
                className={`mt-1 truncate text-[11px] ${i === step ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}
              >
                {s}
              </p>
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card>
            <div className="grid grid-cols-2 gap-x-3">
              <Field label="身高">
                <NumberInput value={draft.heightCm} onChange={(v) => patch({ heightCm: v })} min={80} max={250} suffix="cm" />
              </Field>
              <Field label="体重">
                <NumberInput value={draft.weightKg} onChange={(v) => patch({ weightKg: v })} min={25} max={300} step={0.1} suffix="kg" />
              </Field>
              <Field label="年龄">
                <NumberInput value={draft.age} onChange={(v) => patch({ age: v })} min={12} max={90} suffix="岁" />
              </Field>
              <Field label="性别">
                <div className="flex gap-1.5">
                  {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                    <Chip key={g} size="sm" active={draft.gender === g} onClick={() => patch({ gender: g })}>
                      {GENDER_LABEL[g]}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-slate-400 dark:text-slate-500">
              身高体重用于估算起始重量；性别与年龄会影响估算系数。
            </p>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <Field label="训练经验">
              <div className="flex flex-col gap-2">
                {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((e) => (
                  <Chip key={e} active={draft.experience === e} onClick={() => patch({ experience: e })} className="justify-start">
                    {EXPERIENCE_LABEL[e]}
                  </Chip>
                ))}
              </div>
            </Field>

            {/* 快速定级：填几个动作的重量×次数，自动估算经验等级 */}
            <div className="mb-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
                练过？填 1–3 个动作快速定级（选填）
              </p>
              <p className="mt-0.5 text-[12px] leading-5 text-slate-400 dark:text-slate-500">
                填你能完成的重量与次数，自动估算经验等级，并把重量作为计划起始重量，省去后面慢慢调。
              </p>
              <div className="mt-2.5 space-y-2">
                {lifts.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={l.exerciseId}
                      onChange={(e) =>
                        setLifts((ls) => ls.map((x, j) => (j === i ? { ...x, exerciseId: e.target.value } : x)))
                      }
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-[13px] dark:border-slate-700 dark:bg-slate-900"
                    >
                      {STRENGTH_TEST_EXERCISE_IDS.map((id) => (
                        <option key={id} value={id}>
                          {state.exercises.find((x) => x.id === id)?.name ?? id}
                        </option>
                      ))}
                    </select>
                    <div className="w-[76px] shrink-0">
                      <NumberInput
                        value={l.weightKg || ''}
                        onChange={(v) => setLifts((ls) => ls.map((x, j) => (j === i ? { ...x, weightKg: v } : x)))}
                        min={0}
                        step={2.5}
                        suffix="kg"
                        placeholder="重量"
                      />
                    </div>
                    <div className="w-[68px] shrink-0">
                      <NumberInput
                        value={l.reps || ''}
                        onChange={(v) => setLifts((ls) => ls.map((x, j) => (j === i ? { ...x, reps: v } : x)))}
                        min={0}
                        suffix="次"
                        placeholder="次数"
                      />
                    </div>
                    {lifts.length > 1 && (
                      <button
                        type="button"
                        aria-label="删除这一行"
                        onClick={() => setLifts((ls) => ls.filter((_, j) => j !== i))}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 dark:active:bg-slate-800"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                {lifts.length < 3 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setLifts((ls) => [
                        ...ls,
                        {
                          exerciseId:
                            STRENGTH_TEST_EXERCISE_IDS.find((id) => !ls.some((l) => l.exerciseId === id)) ??
                            STRENGTH_TEST_EXERCISE_IDS[0],
                          weightKg: 0,
                          reps: 0,
                        },
                      ])
                    }
                    className="text-[13px] text-brand-600 dark:text-brand-400"
                  >
                    + 再加一个动作
                  </button>
                ) : (
                  <span />
                )}
                {estimated && (
                  <button
                    type="button"
                    onClick={() => patch({ experience: estimated })}
                    className="rounded-full bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-700 transition active:scale-95 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    估算：{EXPERIENCE_LABEL[estimated]}（点我采用）
                  </button>
                )}
              </div>
              {validLifts.length > 0 && (
                <p className="mt-1.5 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
                  {validLifts
                    .map((l) => {
                      const name = state.exercises.find((x) => x.id === l.exerciseId)?.name ?? ''
                      return `${name} 1RM≈${epley1RM(l.weightKg, l.reps)}kg`
                    })
                    .join(' · ')}
                </p>
              )}
            </div>

            <Field label="训练目标（单选）">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                  <Chip key={g} active={draft.goal === g} onClick={() => patch({ goal: g })}>
                    {GOAL_LABEL[g]}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-slate-400 dark:text-slate-500">{GOAL_DESC[draft.goal]}</p>
            </Field>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <Field label={`每周可训练天数：${draft.daysPerWeek} 天`} hint="1–2 天全身分化；3 天推/拉/腿；4 天上下肢；5–6 天推拉腿加弱项">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <Chip
                    key={d}
                    className="flex-1"
                    active={draft.daysPerWeek === d}
                    onClick={() => patch({ daysPerWeek: d as Draft['daysPerWeek'] })}
                  >
                    {d}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="单次训练时长">
              <div className="flex gap-2">
                {([30, 45, 60, 90] as const).map((m) => (
                  <Chip key={m} className="flex-1" active={draft.sessionMinutes === m} onClick={() => patch({ sessionMinutes: m })}>
                    {m} 分
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="伤病与禁忌部位（可多选）" hint="勾选后，计划会自动过滤掉可能加重该部位负担的动作">
              <TagMultiSelect
                options={(Object.keys(BODY_REGION_LABEL) as BodyRegion[]).map((r) => ({
                  value: r,
                  label: BODY_REGION_LABEL[r],
                }))}
                values={draft.injuries}
                onChange={(injuries) => patch({ injuries })}
              />
            </Field>
            <Field label="其他健康状况（可多选，选填）">
              <TagMultiSelect
                size="sm"
                options={MEDICAL_FLAGS.map((f) => ({ value: f, label: f }))}
                values={draft.medicalFlags}
                onChange={(medicalFlags) => patch({ medicalFlags })}
              />
            </Field>
            {draft.injuries.length > 0 || draft.medicalFlags.length > 0 ? (
              <DisclaimerBar />
            ) : null}
          </Card>
        )}

        {step === 3 && (
          <Card>
            <PreferenceEditor prefs={draft} onChange={patch} />
          </Card>
        )}

        {step === 4 && (
          <Card>
            <p className="mb-3 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
              勾选你健身房里有的器械。计划里的动作<strong className="text-slate-700 dark:text-slate-200">只会来自这里勾选的器械</strong>。
              已为你预选一组常见器械，可自行调整。
            </p>
            <EquipmentPicker selected={selected} onChange={setSelected} />
            <div className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              已选 {selected.length} 项
            </div>
          </Card>
        )}

        <div className="mt-5 flex gap-2">
          {step > 0 && (
            <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)} className="flex-1">
              上一步
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="lg" full disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              下一步
            </Button>
          ) : (
            <Button size="lg" full disabled={!canNext} onClick={finish}>
              生成我的计划
            </Button>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-400 dark:text-slate-500">
          所有数据仅保存在本机浏览器，不会上传任何服务器。
        </p>
      </div>
    </div>
  )
}
