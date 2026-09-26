import type {
  EquipmentPreference,
  MuscleEmphasis,
  MuscleGroup,
  Profile,
  TrainingRhythm,
  VolumePreference,
} from '@/types'
import {
  EQUIPMENT_PREFERENCE_DESC,
  EQUIPMENT_PREFERENCE_LABEL,
  MUSCLE_EMPHASIS_DESC,
  MUSCLE_EMPHASIS_LABEL,
  MUSCLE_GROUP_LABEL,
  RHYTHM_DESC,
  RHYTHM_LABEL,
  WEEKDAY_SHORT,
} from '@/lib/labels'
import { Chip, Field } from './ui'
import { RHYTHM_MAX_DAYS, suggestWeekdays } from '@/engine/split'

export type PreferenceDraft = Pick<
  Profile,
  | 'daysPerWeek'
  | 'sessionMinutes'
  | 'trainingRhythm'
  | 'customWeekdays'
  | 'cardioWeekdays'
  | 'equipmentPreference'
  | 'muscleEmphasis'
  | 'volume'
>

/** 点击循环：正常 → 少练 → 加强 → 不练 → 正常 */
const EMPHASIS_CYCLE: MuscleEmphasis[] = ['normal', 'less', 'more', 'none']
const EMPHASIS_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
]

const AUTO = 0

export function PreferenceEditor({
  prefs,
  onChange,
}: {
  prefs: PreferenceDraft
  onChange: (patch: Partial<PreferenceDraft>) => void
}) {
  const rhythm = prefs.trainingRhythm ?? 'consecutive'
  const custom = prefs.customWeekdays ?? []
  const cardio = prefs.cardioWeekdays ?? []
  const preference = prefs.equipmentPreference ?? 'any'
  const emphasis = prefs.muscleEmphasis ?? {}
  const volume = prefs.volume ?? {}

  const weekdays = suggestWeekdays(prefs.daysPerWeek, rhythm, custom)
  const toggle = (list: number[], i: number) =>
    list.includes(i) ? list.filter((x) => x !== i) : [...list, i].sort((a, b) => a - b)

  const setVolume = (patch: Partial<VolumePreference>) => onChange({ volume: { ...volume, ...patch } })
  const setEmphasis = (g: MuscleGroup, next: MuscleEmphasis) =>
    onChange({ muscleEmphasis: { ...emphasis, [g]: next } })

  const count = volume.exercisesPerSession ?? AUTO
  const sets = volume.setsPerExercise ?? AUTO
  const reps = volume.repsPerSet ?? AUTO
  // 粗略估算：每组动作时间 ≈ 次数 × 3 秒 + 10 秒，组间休息按 75 秒，再加热身放松约 9 分钟
  const roughMinutes =
    count && sets && reps
      ? Math.round((count * (sets * (reps * 3 + 10) + 75 * (sets - 1))) / 60 + 9)
      : null

  return (
    <>
      <Field label="训练节奏" hint="决定每周哪几天训练、休息日怎么分布">
        <div className="flex flex-col gap-2">
          {(Object.keys(RHYTHM_LABEL) as TrainingRhythm[]).map((r) => (
            <Chip
              key={r}
              active={rhythm === r}
              onClick={() => onChange({ trainingRhythm: r })}
              className="justify-start"
            >
              {RHYTHM_LABEL[r]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-5 text-slate-400 dark:text-slate-500">{RHYTHM_DESC[rhythm]}</p>
      </Field>

      {rhythm === 'custom' && (
        <Field label="自定义训练日（可多选）" hint="选中几天就每周练几天">
          <div className="flex gap-1.5">
            {WEEKDAY_SHORT.map((w, i) => (
              <Chip
                key={w}
                size="sm"
                className="flex-1 justify-center"
                active={custom.includes(i)}
                onClick={() => {
                  const next = toggle(custom, i)
                  onChange({
                    customWeekdays: next,
                    daysPerWeek: (Math.min(6, Math.max(1, next.length)) || 1) as Profile['daysPerWeek'],
                  })
                }}
              >
                {w}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        每周训练日：
        <strong className="text-slate-700 dark:text-slate-200">
          {weekdays.map((d) => `周${WEEKDAY_SHORT[d]}`).join(' / ') || '—'}
        </strong>
        {(RHYTHM_MAX_DAYS[rhythm] ?? 6) < weekdays.length && (
          <span className="mt-1 block text-amber-600 dark:text-amber-400">
            {RHYTHM_LABEL[rhythm]}每周最多安排 {RHYTHM_MAX_DAYS[rhythm]} 练，多出的训练日已排在相邻日期。
          </span>
        )}
      </div>

      <Field label="每周有氧日（可多选，选填）" hint="选中的这天会安排成纯有氧训练">
        <div className="flex gap-1.5">
          {WEEKDAY_SHORT.map((w, i) => (
            <Chip
              key={w}
              size="sm"
              className="flex-1 justify-center"
              active={cardio.includes(i)}
              onClick={() => onChange({ cardioWeekdays: toggle(cardio, i) })}
            >
              {w}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="训练容量" hint="不习惯自动排的组数次数？在这里固定成你自己的练法">
        <div className="space-y-3">
          <CapacityRow
            label="每次动作数"
            value={count}
            options={[4, 5, 6, 7, 8]}
            onPick={(v) => setVolume({ exercisesPerSession: v || undefined })}
          />
          <CapacityRow
            label="每个动作组数"
            value={sets}
            options={[2, 3, 4, 5]}
            onPick={(v) => setVolume({ setsPerExercise: v || undefined })}
          />
          <CapacityRow
            label="每组次数"
            value={reps}
            options={[8, 10, 12, 15]}
            onPick={(v) => setVolume({ repsPerSet: v || undefined })}
          />
        </div>
        <p className="mt-2 text-[12px] leading-5 text-slate-400 dark:text-slate-500">
          {roughMinutes !== null
            ? `按 ${count} 个动作 × ${sets} 组 × ${reps} 次估算，单次约 ${roughMinutes} 分钟，你设定的是 ${prefs.sessionMinutes} 分钟`
            : '选「自动」时按训练目标和经验推导，新手组数更少、中级更多'}
          {roughMinutes !== null && roughMinutes > prefs.sessionMinutes + 10 && (
            <span className="mt-1 block text-amber-600 dark:text-amber-400">
              会比设定的时长多约 {roughMinutes - prefs.sessionMinutes} 分钟，可下调动作数或把单次时长调大。
            </span>
          )}
        </p>
      </Field>

      <Field label="部位侧重" hint={MUSCLE_EMPHASIS_DESC}>
        <div className="flex flex-wrap gap-1.5">
          {EMPHASIS_GROUPS.map((g) => {
            const level: MuscleEmphasis = emphasis[g] ?? 'normal'
            return (
              <Chip
                key={g}
                size="sm"
                active={level !== 'normal'}
                onClick={() => setEmphasis(g, EMPHASIS_CYCLE[(EMPHASIS_CYCLE.indexOf(level) + 1) % EMPHASIS_CYCLE.length])}
              >
                {MUSCLE_GROUP_LABEL[g]}
                {level !== 'normal' ? ` · ${MUSCLE_EMPHASIS_LABEL[level]}` : ''}
              </Chip>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] leading-5 text-slate-400 dark:text-slate-500">
          点一下切换：正常 → 少练 → 加强 → 不练
        </p>
      </Field>

      <Field label="器械偏好" hint="同一肌群有多个动作可选时，按你的偏好排序">
        <div className="flex flex-col gap-2">
          {(Object.keys(EQUIPMENT_PREFERENCE_LABEL) as EquipmentPreference[]).map((p) => (
            <Chip
              key={p}
              active={preference === p}
              onClick={() => onChange({ equipmentPreference: p })}
              className="justify-start"
            >
              {EQUIPMENT_PREFERENCE_LABEL[p]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-5 text-slate-400 dark:text-slate-500">
          {EQUIPMENT_PREFERENCE_DESC[preference]}
        </p>
      </Field>
    </>
  )
}

function CapacityRow({
  label,
  value,
  options,
  onPick,
}: {
  label: string
  value: number
  options: number[]
  onPick: (v: number) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-slate-500 dark:text-slate-400">{label}</p>
      <div className="flex gap-1.5">
        <Chip size="sm" className="flex-1 justify-center" active={value === AUTO} onClick={() => onPick(AUTO)}>
          自动
        </Chip>
        {options.map((v) => (
          <Chip key={v} size="sm" className="flex-1 justify-center" active={value === v} onClick={() => onPick(v)}>
            {v}
          </Chip>
        ))}
      </div>
    </div>
  )
}
