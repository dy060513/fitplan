import { useMemo, useState } from 'react'
import type { Equipment, EquipmentCategory, MuscleGroup } from '@/types'
import { EQUIPMENT_CATEGORY_LABEL, MUSCLE_GROUP_LABEL } from '@/lib/labels'
import { EQUIPMENT_CATEGORY_ORDER } from '@/data/equipment'
import { Button, Chip, Field, Modal, NumberInput, TextInput, cx } from './ui'
import { useApp } from '@/store/AppContext'

const MUSCLE_CHOICES: MuscleGroup[] = [
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
  'cardio',
]

export function EquipmentPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const { state, dispatch } = useApp()
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = state.equipment.filter((e) => !q || e.name.toLowerCase().includes(q))
    return EQUIPMENT_CATEGORY_ORDER.map((cat) => ({
      cat,
      items: list.filter((e) => e.category === cat),
    })).filter((g) => g.items.length > 0)
  }, [state.equipment, query])

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <TextInput value={query} onChange={setQuery} placeholder="搜索器械，如「哑铃」" />
        </div>
        <Button variant="secondary" size="md" onClick={() => setAddOpen(true)} className="shrink-0">
          + 自定义
        </Button>
      </div>

      {grouped.map((g) => (
        <div key={g.cat} className="mb-4">
          <p className="mb-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
            {EQUIPMENT_CATEGORY_LABEL[g.cat as EquipmentCategory]}
            <span className="ml-1 font-normal text-slate-400">({g.items.length})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {g.items.map((e) => (
              <Chip key={e.id} active={selected.includes(e.id)} onClick={() => toggle(e.id)}>
                {e.name}
              </Chip>
            ))}
          </div>
        </div>
      ))}

      {!grouped.length && (
        <p className="py-6 text-center text-[13px] text-slate-400">没有匹配的器械，试试其他关键词</p>
      )}

      <AddEquipmentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(name, category, muscleGroup, weightRange) => {
          dispatch({ type: 'addCustomEquipment', name, category, muscleGroup, weightRange })
          setAddOpen(false)
        }}
      />
    </div>
  )
}

function AddEquipmentModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (
    name: string,
    category: EquipmentCategory,
    muscleGroup: MuscleGroup,
    weightRange?: Equipment['weightRange'],
  ) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<EquipmentCategory>('free')
  const [muscle, setMuscle] = useState<MuscleGroup>('chest')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')

  const submit = () => {
    if (!name.trim()) return
    const lo = Number.parseFloat(min)
    const hi = Number.parseFloat(max)
    onAdd(
      name.trim(),
      category,
      category === 'cardio' ? 'cardio' : muscle,
      Number.isFinite(lo) && Number.isFinite(hi) ? { min: lo, max: hi } : undefined,
    )
    setName('')
    setMin('')
    setMax('')
  }

  return (
    <Modal
      open={open}
      title="新增自定义器械"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={onClose}>
            取消
          </Button>
          <Button full disabled={!name.trim()} onClick={submit}>
            添加并勾选
          </Button>
        </div>
      }
    >
      <Field label="器械名称" hint="系统会为自定义器械生成一个同名动作，用于排入计划">
        <TextInput value={name} onChange={setName} placeholder="例如：战绳 / 雪橇车" maxLength={20} />
      </Field>

      <Field label="分类">
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_CATEGORY_ORDER.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {EQUIPMENT_CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      </Field>

      {category !== 'cardio' && (
        <Field label="主要肌群" hint="用于把它排进对应的训练日">
          <div className="flex flex-wrap gap-2">
            {MUSCLE_CHOICES.filter((m) => m !== 'cardio').map((m) => (
              <Chip key={m} size="sm" active={muscle === m} onClick={() => setMuscle(m)}>
                {MUSCLE_GROUP_LABEL[m]}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="最小重量（选填）">
          <NumberInput value={min} onChange={(v) => setMin(String(v))} min={0} suffix="kg" placeholder="0" />
        </Field>
        <Field label="最大重量（选填）">
          <NumberInput value={max} onChange={(v) => setMax(String(v))} min={0} suffix="kg" placeholder="100" />
        </Field>
      </div>
    </Modal>
  )
}

export function EquipmentSummary({ ids }: { ids: string[] }) {
  const { state } = useApp()
  const names = ids
    .map((id) => state.equipment.find((e) => e.id === id)?.name)
    .filter(Boolean) as string[]
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.slice(0, 8).map((n) => (
        <span
          key={n}
          className={cx(
            'rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600',
            'dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          {n}
        </span>
      ))}
      {names.length > 8 && (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          +{names.length - 8}
        </span>
      )}
      {!names.length && <span className="text-[12px] text-slate-400">尚未勾选器械</span>}
    </div>
  )
}
