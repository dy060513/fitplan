import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { AppState } from '@/types'
import { initialState, STORAGE_KEY, STATE_VERSION } from './defaults'
import { reducer, type Action } from './reducer'

/** 从 localStorage 恢复，做一次轻量结构校验，避免脏数据导致白屏 */
function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (!parsed || typeof parsed !== 'object') return initialState()
    const base = initialState()
    return {
      ...base,
      ...parsed,
      version: STATE_VERSION,
      // 预置库始终以代码为准，避免旧数据缺动作
      equipment: mergeById(base.equipment, parsed.equipment ?? []),
      exercises: mergeById(base.exercises, parsed.exercises ?? []),
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      progress: parsed.progress ?? {},
    }
  } catch {
    return initialState()
  }
}

function mergeById<T extends { id: string }>(base: T[], stored: T[]): T[] {
  const map = new Map(base.map((x) => [x.id, x]))
  for (const item of stored) map.set(item.id, item)
  return [...map.values()]
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  // 持久化：任何状态变化都写入 localStorage，保证刷新不丢数据
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 存储不可用时静默降级，不影响使用 */
    }
  }, [state])

  // 深色模式
  useEffect(() => {
    const root = document.documentElement
    if (state.settings.theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    root.style.colorScheme = state.settings.theme
  }, [state.settings.theme])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内部使用')
  return ctx
}
