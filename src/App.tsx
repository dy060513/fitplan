import { useState } from 'react'
import { useApp } from '@/store/AppContext'
import { BottomNav, type TabKey } from '@/components/BottomNav'
import { Onboarding } from '@/components/Onboarding'
import { Button, DisclaimerBar } from '@/components/ui'
import { PlanPage } from '@/pages/PlanPage'
import { TrainPage } from '@/pages/TrainPage'
import { RecordsPage } from '@/pages/RecordsPage'
import { MePage } from '@/pages/MePage'
import { DisclaimerGate } from '@/components/DisclaimerGate'

const TAB_TITLE: Record<TabKey, string> = {
  plan: '训练计划',
  train: '今日训练',
  records: '数据记录',
  me: '我的',
}

export default function App() {
  const { state } = useApp()
  const [tab, setTab] = useState<TabKey>('plan')

  const accepted = !!state.user?.disclaimerAcceptedAt
  const onboarded = !!state.user?.onboarded && !!state.profile

  if (!accepted) return <DisclaimerGate />
  if (!onboarded) return <Onboarding onDone={() => undefined} />

  return (
    <div className="min-h-screen bg-paper dark:bg-ink">
      <div className="mx-auto max-w-md px-4 pb-24 pt-5">
        <header className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-bold tracking-tight">{TAB_TITLE[tab]}</h1>
          </div>
          {tab === 'plan' && (
            <Button size="sm" variant="secondary" onClick={() => setTab('train')}>
              去训练
            </Button>
          )}
        </header>
        <div key={tab} className="animate-page">
          {tab === 'plan' && <PlanPage onGoTrain={() => setTab('train')} />}
          {tab === 'train' && <TrainPage onGoPlan={() => setTab('plan')} />}
          {tab === 'records' && <RecordsPage />}
          {tab === 'me' && <MePage onGoOnboarding={() => setTab('plan')} />}
        </div>
        <div className="mt-6">
          <DisclaimerBar />
        </div>
      </div>
      <BottomNav value={tab} onChange={setTab} />
    </div>
  )
}
