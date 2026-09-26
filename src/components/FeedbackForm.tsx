import { useState } from 'react'
import type { BodyRegion, Completion, MuscleGroup, PainReport } from '@/types'
import { BODY_REGION_LABEL, COMPLETION_LABEL, MUSCLE_GROUP_LABEL, PAIN_LEVEL_LABEL } from '@/lib/labels'
import { Button, Card, Chip, Field, Modal, NumberInput, TextArea, cx } from './ui'

export interface FeedbackDraft {
  rpe: number
  completion: Completion
  fatigueRegions: MuscleGroup[]
  pain: PainReport | null
  actualMinutes: number
  note: string
}

const FATIGUE_CHOICES: MuscleGroup[] = [
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

const REGIONS = Object.keys(BODY_REGION_LABEL) as BodyRegion[]

const RPE_HINT: Record<number, string> = {
  1: '非常轻松',
  2: '很轻松',
  3: '轻松',
  4: '有点吃力',
  5: '适中',
  6: '稍累',
  7: '吃力',
  8: '很吃力',
  9: '接近力竭',
  10: '完全力竭',
}

export function FeedbackForm({
  open,
  defaultMinutes,
  onClose,
  onSubmit,
}: {
  open: boolean
  defaultMinutes: number
  onClose: () => void
  onSubmit: (draft: FeedbackDraft) => void
}) {
  const [rpe, setRpe] = useState(6)
  const [completion, setCompletion] = useState<Completion>('all')
  const [fatigue, setFatigue] = useState<MuscleGroup[]>([])
  const [hasPain, setHasPain] = useState(false)
  const [painRegion, setPainRegion] = useState<BodyRegion>('shoulder')
  const [painLevel, setPainLevel] = useState<1 | 2 | 3>(1)
  const [minutes, setMinutes] = useState(defaultMinutes)
  const [note, setNote] = useState('')

  const toggleFatigue = (m: MuscleGroup) =>
    setFatigue((f) => (f.includes(m) ? f.filter((x) => x !== m) : [...f, m]))

  const submit = () =>
    onSubmit({
      rpe,
      completion,
      fatigueRegions: fatigue,
      pain: hasPain ? { region: painRegion, level: painLevel } : null,
      actualMinutes: minutes,
      note: note.trim(),
    })

  return (
    <Modal
      open={open}
      title="训练反馈（30 秒填完）"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={onClose}>
            取消
          </Button>
          <Button full onClick={submit}>
            提交并生成调整
          </Button>
        </div>
      }
    >
      <Card className="mb-3">
        <Field label={`整体难度 RPE：${rpe} / 10`} hint={RPE_HINT[rpe]}>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            className="h-11 w-full accent-brand-600"
          />
          <div className="flex justify-between px-0.5 text-[11px] text-slate-400">
            {[1, 5, 10].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </Field>

        <Field label="完成度">
          <div className="flex gap-2">
            {(Object.keys(COMPLETION_LABEL) as Completion[]).map((c) => (
              <Chip key={c} className="flex-1" active={completion === c} onClick={() => setCompletion(c)}>
                {COMPLETION_LABEL[c]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="疲劳部位（可多选）">
          <div className="flex flex-wrap gap-2">
            {FATIGUE_CHOICES.map((m) => (
              <Chip key={m} size="sm" active={fatigue.includes(m)} onClick={() => toggleFatigue(m)}>
                {MUSCLE_GROUP_LABEL[m]}
              </Chip>
            ))}
          </div>
        </Field>
      </Card>

      <Card className="mb-3">
        <button
          type="button"
          onClick={() => setHasPain((h) => !h)}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-[14px] font-medium">是否出现疼痛？</span>
          <span
            className={cx(
              'flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition',
              hasPain ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700',
            )}
          >
            <span
              className={cx(
                'h-5 w-5 rounded-full bg-white shadow transition',
                hasPain && 'translate-x-5',
              )}
            />
          </span>
        </button>

        {hasPain && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 dark:bg-rose-500/10">
            <p className="mb-2 text-[12px] leading-5 text-rose-700 dark:text-rose-300">
              关节疼痛不是正常酸痛。系统会自动停用涉及该部位的动作，如疼痛持续请及时就医。
            </p>
            <Field label="疼痛部位">
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((r) => (
                  <Chip key={r} size="sm" active={painRegion === r} onClick={() => setPainRegion(r)}>
                    {BODY_REGION_LABEL[r]}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="疼痛程度">
              <div className="flex flex-col gap-2">
                {([1, 2, 3] as const).map((l) => (
                  <Chip key={l} active={painLevel === l} onClick={() => setPainLevel(l)} className="justify-start">
                    {PAIN_LEVEL_LABEL[l]}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
        )}
      </Card>

      <Card>
        <Field label="本次实际时长">
          <NumberInput value={minutes} onChange={setMinutes} min={1} max={240} suffix="分钟" />
        </Field>
        <Field label="备注（选填）">
          <TextArea value={note} onChange={setNote} placeholder="例如：卧推第 3 组有点吃力" rows={2} />
        </Field>
      </Card>
    </Modal>
  )
}
