import { useState } from 'react'
import { Button, Card } from './ui'
import { useApp } from '@/store/AppContext'

const ITEMS = [
  '本应用给出的训练计划与建议由本地规则引擎自动生成，基于通用训练原则，不构成医疗建议、诊断或治疗方案。',
  '如果你有伤病、慢性疾病（如心血管或代谢性疾病）、正在服药、或处于孕期 / 产后阶段，请在开始任何训练计划前先咨询医生。',
  '训练中出现头晕、胸闷、关节刺痛或锐痛，请立即停止并寻求专业医疗帮助。',
  '所有数据仅保存在本机浏览器，删除浏览器数据会一并清除，请自行做好备份。',
]

export function DisclaimerGate() {
  const { dispatch } = useApp()
  const [checked, setChecked] = useState(false)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-[#0b0f14]">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mb-2 text-4xl">🏋️</div>
          <h1 className="text-[24px] font-bold tracking-tight">FitPlan</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">个性化健身计划 · 离线可用</p>
        </div>

        <Card>
          <h2 className="mb-3 text-[16px] font-semibold">免责声明与风险提示</h2>
          <ul className="mb-4 space-y-2.5">
            {ITEMS.map((t, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-6 text-slate-600 dark:text-slate-300">
                <span className="mt-0.5 shrink-0 text-brand-500">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setChecked((c) => !c)}
            className="mb-4 flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-slate-50 px-3 text-left dark:bg-slate-800/60"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[12px] ${
                checked
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {checked ? '✓' : ''}
            </span>
            <span className="text-[13px] leading-5 text-slate-700 dark:text-slate-200">
              我已阅读并理解上述内容，愿意自行承担训练风险
            </span>
          </button>

          <Button size="lg" full disabled={!checked} onClick={() => dispatch({ type: 'acceptDisclaimer' })}>
            同意并开始
          </Button>
        </Card>
      </div>
    </div>
  )
}
