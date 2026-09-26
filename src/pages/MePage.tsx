import { useRef, useState } from 'react'
import type { BodyRegion, Experience, Gender, Goal, MuscleEmphasis, MuscleGroup, Profile } from '@/types'
import { useApp } from '@/store/AppContext'
import {
  BODY_REGION_LABEL,
  DISCLAIMER,
  EQUIPMENT_PREFERENCE_LABEL,
  EXPERIENCE_LABEL,
  GENDER_LABEL,
  GOAL_LABEL,
  MEDICAL_FLAGS,
  MUSCLE_EMPHASIS_LABEL,
  MUSCLE_GROUP_LABEL,
  RHYTHM_LABEL,
  WEEKDAY_SHORT,
} from '@/lib/labels'
import { Button, Card, Chip, DisclaimerBar, Field, Modal, NumberInput, SectionTitle, Tag } from '@/components/ui'
import { HoldButton } from '@/components/interactions'
import { EquipmentPicker, EquipmentSummary } from '@/components/EquipmentPicker'
import { PreferenceEditor } from '@/components/PreferenceEditor'
import { formatShortDate, todayISO } from '@/lib/utils'
import { suggestWeekdays } from '@/engine/split'

export function MePage({ onGoOnboarding: _onGoOnboarding }: { onGoOnboarding: () => void }) {
  const { state, dispatch } = useApp()
  const { profile, settings, selectedEquipmentIds } = state
  const [editOpen, setEditOpen] = useState(false)
  const [equipOpen, setEquipOpen] = useState(false)
  const [prefOpen, setPrefOpen] = useState(false)
  const [weight, setWeight] = useState('')
  const [draftEquip, setDraftEquip] = useState<string[]>(selectedEquipmentIds)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!profile) return null

  const prefWeekdays = suggestWeekdays(
    profile.daysPerWeek,
    profile.trainingRhythm ?? 'consecutive',
    profile.customWeekdays ?? [],
  )
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true

  const vol = profile.volume ?? {}
  const volumeText = vol.exercisesPerSession || vol.setsPerExercise || vol.repsPerSet
    ? `${vol.exercisesPerSession ?? '自动'} 个动作 × ${vol.setsPerExercise ?? '自动'} 组 × ${vol.repsPerSet ?? '自动'} 次`
    : '自动（按目标与经验推导）'
  const emphasisList = (
    Object.entries(profile.muscleEmphasis ?? {}) as [MuscleGroup, MuscleEmphasis][]
  ).filter(([, v]) => v && v !== 'normal')

  const addWeight = () => {
    const kg = Number.parseFloat(weight)
    if (!Number.isFinite(kg) || kg <= 0) return
    dispatch({ type: 'addWeightLog', kg })
    setWeight('')
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fitplan-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (parsed && typeof parsed === 'object') {
          dispatch({ type: 'importState', state: parsed })
          alert('导入成功')
        }
      } catch {
        alert('文件格式不正确')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">身体档案</h2>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              {profile.heightCm} cm · {profile.weightKg} kg · {profile.age} 岁 · {GENDER_LABEL[profile.gender]}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            编辑
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag tone="brand">{EXPERIENCE_LABEL[profile.experience]}</Tag>
          <Tag>{GOAL_LABEL[profile.goal]}</Tag>
          <Tag>每周 {profile.daysPerWeek} 天</Tag>
          <Tag>{profile.sessionMinutes} 分钟 / 次</Tag>
          {profile.injuries.map((i) => (
            <Tag key={i} tone="warn">
              禁忌 · {BODY_REGION_LABEL[i]}
            </Tag>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">我的器械</h2>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">已勾选 {selectedEquipmentIds.length} 项</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraftEquip(selectedEquipmentIds)
              setEquipOpen(true)
            }}
          >
            编辑
          </Button>
        </div>
        <div className="mt-3">
          <EquipmentSummary ids={selectedEquipmentIds} />
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">训练偏好</h2>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              {RHYTHM_LABEL[profile.trainingRhythm ?? 'consecutive']} ·{' '}
              {EQUIPMENT_PREFERENCE_LABEL[profile.equipmentPreference ?? 'any']}
            </p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              训练日：{prefWeekdays.map((d) => `周${WEEKDAY_SHORT[d]}`).join(' / ') || '—'}
              {profile.cardioWeekdays?.length
                ? ` · 有氧日：${profile.cardioWeekdays.map((d) => `周${WEEKDAY_SHORT[d]}`).join(' / ')}`
                : ''}
            </p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">单次容量：{volumeText}</p>
            {emphasisList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emphasisList.map(([g, v]) => (
                  <Tag key={g} tone="warn">
                    {MUSCLE_GROUP_LABEL[g]} · {MUSCLE_EMPHASIS_LABEL[v]}
                  </Tag>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPrefOpen(true)}>
            编辑
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <SectionTitle>体重记录</SectionTitle>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <NumberInput value={weight} onChange={(v) => setWeight(String(v))} step={0.1} suffix="kg" placeholder="今日体重" />
          </div>
          <Button onClick={addWeight} className="shrink-0">
            记录
          </Button>
        </div>
        {profile.weightLogs.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {profile.weightLogs
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 8)
              .map((w) => (
                <div key={w.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-500 dark:text-slate-400">{formatShortDate(w.date)}</span>
                  <span className="font-medium">{w.kg} kg</span>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle>设置</SectionTitle>
        <Field label="外观">
          <div className="flex gap-2">
            <Chip
              className="flex-1"
              active={settings.theme === 'light'}
              onClick={() => dispatch({ type: 'setSettings', patch: { theme: 'light' } })}
            >
              浅色
            </Chip>
            <Chip
              className="flex-1"
              active={settings.theme === 'dark'}
              onClick={() => dispatch({ type: 'setSettings', patch: { theme: 'dark' } })}
            >
              深色
            </Chip>
          </div>
        </Field>
        <Field label="中周期周数" hint="修改后需重新生成计划才会生效">
          <div className="flex gap-2">
            {[2, 4, 6].map((n) => (
              <Chip
                key={n}
                className="flex-1"
                active={settings.mesocycleWeeks === n}
                onClick={() => dispatch({ type: 'setSettings', patch: { mesocycleWeeks: n } })}
              >
                {n} 周
              </Chip>
            ))}
          </div>
        </Field>
      </Card>

      <Card className="mb-4">
        <SectionTitle>安装到手机桌面</SectionTitle>
        {isStandalone ? (
          <p className="text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            当前已作为 App 运行。从桌面图标进入即可全屏使用，断网也能记录和训练。
          </p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            <li>iPhone：用 Safari 打开本页 → 底部「分享」→「添加到主屏幕」</li>
            <li>安卓：用 Chrome 打开本页 → 右上角菜单 →「安装应用 / 添加到主屏幕」</li>
            <li>添加后从桌面图标进入，全屏无地址栏，离线可用</li>
          </ol>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle>数据管理</SectionTitle>
        <div className="space-y-2">
          <Button variant="secondary" full onClick={exportData}>
            导出数据备份（JSON）
          </Button>
          <Button variant="secondary" full onClick={() => fileRef.current?.click()}>
            导入数据备份
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importData(f)
              e.target.value = ''
            }}
          />
          <HoldButton
            full
            label="长按清空所有数据"
            holdingLabel="松手取消，继续按住将清空全部数据…"
            duration={1600}
            onConfirm={() => {
              dispatch({ type: 'reset' })
              location.reload()
            }}
          />
        </div>
      </Card>

      <Card>
        <p className="text-[12px] leading-6 text-slate-500 dark:text-slate-400">{DISCLAIMER}</p>
        <div className="mt-2">
          <DisclaimerBar />
        </div>
      </Card>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
      <TrainingPreferenceModal open={prefOpen} onClose={() => setPrefOpen(false)} />

      <Modal
        open={equipOpen}
        title="编辑我的器械"
        onClose={() => setEquipOpen(false)}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setEquipOpen(false)}>
              取消
            </Button>
            <Button
              full
              onClick={() => {
                dispatch({ type: 'setEquipmentSelection', ids: draftEquip })
                setEquipOpen(false)
                if (confirm('器械已更新，是否立即重新生成计划？')) dispatch({ type: 'generatePlan' })
              }}
            >
              保存
            </Button>
          </div>
        }
      >
        <EquipmentPicker selected={draftEquip} onChange={setDraftEquip} />
      </Modal>
    </div>
  )
}

function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const profile = state.profile
  const [draft, setDraft] = useState<Profile | null>(profile)

  if (!profile) return null
  const d = draft ?? profile
  const patch = (p: Partial<Profile>) => setDraft({ ...d, ...p })

  const save = () => {
    dispatch({
      type: 'saveProfile',
      patch: {
        heightCm: d.heightCm,
        weightKg: d.weightKg,
        age: d.age,
        gender: d.gender,
        experience: d.experience,
        goal: d.goal,
        daysPerWeek: d.daysPerWeek,
        sessionMinutes: d.sessionMinutes,
        injuries: d.injuries,
        medicalFlags: d.medicalFlags,
      },
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      title="编辑身体档案"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={onClose}>
            取消
          </Button>
          <Button
            full
            onClick={() => {
              save()
              if (confirm('档案已更新，是否立即重新生成计划以应用新设置？')) dispatch({ type: 'generatePlan' })
            }}
          >
            保存
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="身高">
          <NumberInput value={d.heightCm} onChange={(v) => patch({ heightCm: v })} suffix="cm" />
        </Field>
        <Field label="体重">
          <NumberInput value={d.weightKg} onChange={(v) => patch({ weightKg: v })} step={0.1} suffix="kg" />
        </Field>
        <Field label="年龄">
          <NumberInput value={d.age} onChange={(v) => patch({ age: v })} suffix="岁" />
        </Field>
        <Field label="性别">
          <div className="flex gap-1.5">
            {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
              <Chip key={g} size="sm" active={d.gender === g} onClick={() => patch({ gender: g })}>
                {GENDER_LABEL[g]}
              </Chip>
            ))}
          </div>
        </Field>
      </div>

      <Field label="训练经验">
        <div className="flex flex-col gap-2">
          {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((e) => (
            <Chip key={e} active={d.experience === e} onClick={() => patch({ experience: e })} className="justify-start">
              {EXPERIENCE_LABEL[e]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="训练目标">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <Chip key={g} active={d.goal === g} onClick={() => patch({ goal: g })}>
              {GOAL_LABEL[g]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label={`每周可训练天数：${d.daysPerWeek} 天`}>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Chip
              key={n}
              className="flex-1"
              active={d.daysPerWeek === n}
              onClick={() => patch({ daysPerWeek: n as Profile['daysPerWeek'] })}
            >
              {n}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="单次训练时长">
        <div className="flex gap-2">
          {([30, 45, 60, 90] as const).map((m) => (
            <Chip key={m} className="flex-1" active={d.sessionMinutes === m} onClick={() => patch({ sessionMinutes: m })}>
              {m} 分
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="伤病与禁忌部位">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BODY_REGION_LABEL) as BodyRegion[]).map((r) => (
            <Chip
              key={r}
              active={d.injuries.includes(r)}
              onClick={() =>
                patch({
                  injuries: d.injuries.includes(r) ? d.injuries.filter((x) => x !== r) : [...d.injuries, r],
                })
              }
            >
              {BODY_REGION_LABEL[r]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="其他健康状况">
        <div className="flex flex-wrap gap-2">
          {MEDICAL_FLAGS.map((f) => (
            <Chip
              key={f}
              size="sm"
              active={d.medicalFlags.includes(f)}
              onClick={() =>
                patch({
                  medicalFlags: d.medicalFlags.includes(f)
                    ? d.medicalFlags.filter((x) => x !== f)
                    : [...d.medicalFlags, f],
                })
              }
            >
              {f}
            </Chip>
          ))}
        </div>
      </Field>
    </Modal>
  )
}

function TrainingPreferenceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const profile = state.profile
  if (!profile) return null

  const close = () => {
    onClose()
    if (confirm('训练偏好已更新，是否立即重新生成计划以应用新设置？')) dispatch({ type: 'generatePlan' })
  }

  return (
    <Modal
      open={open}
      title="训练偏好"
      onClose={close}
      footer={
        <Button full onClick={close}>
          完成
        </Button>
      }
    >
      <PreferenceEditor
        prefs={profile}
        onChange={(patch) => dispatch({ type: 'saveProfile', patch })}
      />
    </Modal>
  )
}
