import { useMemo, useState } from 'react'

interface ContributionDay {
  date: string
  count: number
}

interface ContributionHeatmapProps {
  data: ContributionDay[]
  year: number
}

interface MonthLabel {
  name: string
  weekStart: number
  weekCount: number
}

export function ContributionHeatmap({ data, year }: ContributionHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<ContributionDay | null>(null)

  const { allDays, monthLabels } = useMemo(() => {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59)

    // Start from the first Sunday before or on Jan 1
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() - currentDate.getDay())

    const allDays: (ContributionDay | null)[] = []
    let iterationCount = 0
    const maxIterations = 400

    // Generate all days
    while (iterationCount < maxIterations && currentDate <= endDate) {
      iterationCount++
      const dateStr = currentDate.toISOString().split('T')[0]
      const contribution = data.find(d => d.date === dateStr)

      if (currentDate >= startDate && currentDate <= endDate) {
        allDays.push(contribution || { date: dateStr, count: 0 })
      } else {
        allDays.push(null)
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate month labels by finding where each month starts
    const monthLabels: MonthLabel[] = []
    let lastMonth = -1
    let monthStart = 0

    allDays.forEach((day, index) => {
      if (!day) return

      const dayDate = new Date(day.date)
      const month = dayDate.getMonth()
      const weekIndex = Math.floor(index / 7)

      if (month !== lastMonth) {
        // Close previous month
        if (lastMonth !== -1 && monthLabels.length > 0) {
          monthLabels[monthLabels.length - 1].weekCount = weekIndex - monthStart
        }

        // Start new month
        monthLabels.push({
          name: dayDate.toLocaleDateString('en-US', { month: 'short' }),
          weekStart: weekIndex,
          weekCount: 0, // Will be calculated when next month starts or at the end
        })
        monthStart = weekIndex
        lastMonth = month
      }
    })

    // Close the last month
    if (monthLabels.length > 0) {
      const totalWeeks = Math.ceil(allDays.length / 7)
      monthLabels[monthLabels.length - 1].weekCount = totalWeeks - monthStart
    }

    return { allDays, monthLabels }
  }, [data, year])

  const getColor = (count: number) => {
    if (count === 0) return 'bg-[#161b22]'
    if (count === 1) return 'bg-[#0e4429]'
    if (count === 2) return 'bg-[#006d32]'
    if (count === 3) return 'bg-[#26a641]'
    return 'bg-[#39d353]'
  }

  const totalWeeks = Math.ceil(allDays.length / 7)

  return (
    <div className="relative">
      <style>{`
        .contribution-graph {
          --square-size: 13px;
          --square-gap: 2px;
          --week-width: calc(var(--square-size) + var(--square-gap));
        }
      `}</style>

      <div className="contribution-graph inline-grid" style={{
        gridTemplateAreas: '"empty months" "days squares"',
        gridTemplateColumns: 'auto 1fr',
        gap: '8px 10px',
      }}>
        {/* Empty corner */}
        <div style={{ gridArea: 'empty' }} />

        {/* Month labels */}
        <div
          style={{
            gridArea: 'months',
            display: 'grid',
            gridTemplateColumns: monthLabels.map(m =>
              `calc(var(--week-width) * ${m.weekCount})`
            ).join(' '),
            gap: '0',
          }}
        >
          {monthLabels.map((month, idx) => (
            <div
              key={idx}
              className="text-[11px] text-[#8b949e]"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingLeft: '2px'
              }}
            >
              {month.name}
            </div>
          ))}
        </div>

        {/* Day labels */}
        <div
          style={{
            gridArea: 'days',
            display: 'grid',
            gridTemplateRows: 'repeat(7, var(--square-size))',
            gap: 'var(--square-gap)',
            alignContent: 'start',
          }}
          className="text-[10px] text-[#8b949e]"
        >
          <div style={{ lineHeight: 'var(--square-size)' }}>Mon</div>
          <div style={{ visibility: 'hidden', lineHeight: 'var(--square-size)' }}>Tue</div>
          <div style={{ lineHeight: 'var(--square-size)' }}>Wed</div>
          <div style={{ visibility: 'hidden', lineHeight: 'var(--square-size)' }}>Thu</div>
          <div style={{ lineHeight: 'var(--square-size)' }}>Fri</div>
          <div style={{ visibility: 'hidden', lineHeight: 'var(--square-size)' }}>Sat</div>
          <div style={{ visibility: 'hidden', lineHeight: 'var(--square-size)' }}>Sun</div>
        </div>

        {/* Contribution squares */}
        <div
          style={{
            gridArea: 'squares',
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 'var(--square-size)',
            gridTemplateRows: 'repeat(7, var(--square-size))',
            gap: 'var(--square-gap)',
          }}
        >
          {allDays.map((day, idx) => (
            <div
              key={idx}
              onMouseEnter={() => day && setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              className={`rounded-[2px] transition-all ${
                day ? `${getColor(day.count)} border border-[#1b1f23]/40` : 'bg-transparent'
              } ${day && day.count > 0 ? 'hover:ring-1 hover:ring-white/30 cursor-pointer' : ''}`}
              title={day ? `${day.date}: ${day.count} uploads` : ''}
              style={{
                width: 'var(--square-size)',
                height: 'var(--square-size)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div className="absolute top-full left-0 mt-2 bg-[#161b22] text-[#c9d1d9] px-2 py-1.5 rounded shadow-lg text-xs border border-[#30363d] z-10 whitespace-nowrap">
          <div className="font-medium">
            {hoveredDay.count} {hoveredDay.count === 1 ? 'upload' : 'uploads'} on {new Date(hoveredDay.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-xs text-[#8b949e] mt-4 justify-end">
        <span>Less</span>
        <div className="flex gap-[2px]">
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#161b22] border border-[#1b1f23]/40"></div>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#0e4429] border border-[#1b1f23]/40"></div>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#006d32] border border-[#1b1f23]/40"></div>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#26a641] border border-[#1b1f23]/40"></div>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#39d353] border border-[#1b1f23]/40"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  )
}

