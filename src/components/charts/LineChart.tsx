export interface LinePoint {
  label: string
  value: number
}

/**
 * 轻量 SVG 折线图（无第三方依赖，离线可用）
 * 宽度自适应容器，高度固定
 */
export function LineChart({
  points,
  height = 150,
  color = '#338bff',
  unit = '',
  decimals = 1,
}: {
  points: LinePoint[]
  height?: number
  color?: string
  unit?: string
  decimals?: number
}) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-[12px] text-slate-400 dark:border-slate-700"
        style={{ height }}
      >
        暂无数据
      </div>
    )
  }

  const W = 300
  const H = height
  const padL = 34
  const padR = 10
  const padT = 12
  const padB = 22

  const values = points.map((p) => p.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const span = rawMax - rawMin || 1
  const min = rawMin - span * 0.15
  const max = rawMax + span * 0.15

  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(points.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`

  const ticks = [max, (max + min) / 2, min]
  const labelIdx = points.length <= 4 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
          <text x={padL - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.45">
            {t.toFixed(decimals)}
          </text>
        </g>
      ))}

      <path d={area} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={points.length > 12 ? 1.8 : 2.8} fill={color} />
      ))}

      {labelIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 6}
          textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
          fontSize="9"
          fill="currentColor"
          fillOpacity="0.45"
        >
          {points[i].label}
        </text>
      ))}

      <text x={W - padR} y={padT - 2} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.35">
        {unit}
      </text>
    </svg>
  )
}

/** 环形进度 */
export function Ring({ percent, label, sub }: { percent: number; label: string; sub?: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, percent))
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#338bff"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="44" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">
          {Math.round(p * 100)}%
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold">{label}</p>
        {sub && <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

/** 简易柱状图 */
export function Bars({ data, color = '#338bff' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-1.5" style={{ height: 90 }}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t-md"
            style={{ height: `${Math.max(4, (d.value / max) * 62)}px`, background: color, opacity: 0.85 }}
          />
          <span className="truncate text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
