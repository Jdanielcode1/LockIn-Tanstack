import { useMemo, useState } from 'react'

interface ContributionDay {
  date: string
  count: number
}

interface ContributionHeatmapProps {
  data: ContributionDay[]
  year: number
}

export function ContributionHeatmap({ data, year }: ContributionHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<ContributionDay | null>(null)

  const weeks = useMemo(() => {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59)
    const weeks: (ContributionDay | null)[][] = []
    
    // Start from the first Sunday before or on Jan 1
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() - currentDate.getDay())
    
    let currentWeek: (ContributionDay | null)[] = []
    let iterationCount = 0
    const maxIterations = 400 // Safety limit (53 weeks * 7 days = 371 days)
    
    while (iterationCount < maxIterations) {
      iterationCount++
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
        
        // Stop if we've gone past the end date
        if (currentDate > endDate) {
          break
        }
      }
      
      const dateStr = currentDate.toISOString().split('T')[0]
      const contribution = data.find(d => d.date === dateStr)
      
      if (currentDate >= startDate && currentDate <= endDate) {
        currentWeek.push(contribution || { date: dateStr, count: 0 })
      } else {
        currentWeek.push(null)
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeks.push(currentWeek)
    }
    
    return weeks
  }, [data, year])

  const getColor = (count: number) => {
    if (count === 0) return 'bg-[#161b22]'
    if (count === 1) return 'bg-[#0e4429]'
    if (count === 2) return 'bg-[#006d32]'
    if (count === 3) return 'bg-[#26a641]'
    return 'bg-[#39d353]'
  }

  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="relative">
      <div className="flex gap-[3px] overflow-x-auto pb-4">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[3px]">
            {week.map((day, dayIdx) => (
              <div
                key={dayIdx}
                onMouseEnter={() => day && setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`w-[11px] h-[11px] rounded-sm transition-all border border-[#1b1f23] ${
                  day ? getColor(day.count) : 'bg-transparent'
                } ${day && day.count > 0 ? 'hover:ring-1 hover:ring-[#8b949e] cursor-pointer' : ''}`}
                title={day ? `${day.date}: ${day.count} uploads` : ''}
              />
            ))}
          </div>
        ))}
      </div>
      
      {hoveredDay && (
        <div className="absolute bottom-0 left-0 bg-[#161b22] text-[#c9d1d9] px-2 py-1.5 rounded shadow-lg text-xs border border-[#30363d] z-10 whitespace-nowrap">
          <div className="font-medium">
            {hoveredDay.count} {hoveredDay.count === 1 ? 'upload' : 'uploads'} on {new Date(hoveredDay.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-1 text-xs text-[#8b949e] mt-3">
        <span>Less</span>
        <div className="flex gap-[3px]">
          <div className="w-[10px] h-[10px] rounded-sm bg-[#161b22] border border-[#1b1f23]"></div>
          <div className="w-[10px] h-[10px] rounded-sm bg-[#0e4429] border border-[#1b1f23]"></div>
          <div className="w-[10px] h-[10px] rounded-sm bg-[#006d32] border border-[#1b1f23]"></div>
          <div className="w-[10px] h-[10px] rounded-sm bg-[#26a641] border border-[#1b1f23]"></div>
          <div className="w-[10px] h-[10px] rounded-sm bg-[#39d353] border border-[#1b1f23]"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  )
}

