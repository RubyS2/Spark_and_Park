import React from 'react'

export default function ParkCard({ park, onClick }) {
  const getRiskBadge = (risk) => {
    if (risk === 'low') return 'bg-emerald-900 text-emerald-300'
    if (risk === 'moderate') return 'bg-yellow-900 text-yellow-300'
    return 'bg-orange-900 text-orange-300'
  }

  const getBBQBadge = (bbq) => {
    if (bbq === 'charcoal') return 'bg-emerald-900 text-emerald-300'
    if (bbq === 'gas-only') return 'bg-yellow-900 text-yellow-300'
    return 'bg-red-900 text-red-300'
  }

  return (
    <div 
      onClick={onClick}
      className="bg-zinc-950 border border-zinc-800 hover:border-emerald-700 rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.985]"
    >
      <div className="font-semibold text-[15px]">{park.name}</div>
      
      <div className="flex items-center gap-x-2 mt-2">
        <span className={`px-2.5 py-px text-[10px] rounded-2xl font-medium ${getBBQBadge(park.bbq)}`}>
          {park.bbq === 'charcoal' ? 'Charcoal + Gas' : park.bbq === 'gas-only' ? 'Gas Only' : 'No BBQ'}
        </span>
        <span className="text-xs text-zinc-500">{park.distance}</span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-x-1">
          <div className="flex text-amber-400 text-sm">
            {'★'.repeat(Math.floor(park.rating))}
            {'☆'.repeat(5 - Math.floor(park.rating))}
          </div>
          <span className="text-xs text-zinc-400">({park.reviewCount})</span>
        </div>
        
        <div className={`px-2.5 py-px text-[10px] rounded-2xl font-medium ${getRiskBadge(park.risk)}`}>
          {park.risk.charAt(0).toUpperCase() + park.risk.slice(1)} risk
        </div>
      </div>
    </div>
  )
}