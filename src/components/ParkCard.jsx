import React from 'react'
import { useTranslation } from 'react-i18next'

function ParkCard({ park, onClick }) {
  const { t } = useTranslation()

  let badgeColor = 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
  let badgeText = t('card.noBbq')
  if (park.bbq === 'charcoal') {
    badgeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
    badgeText = t('card.charcoal')
  } else if (park.bbq === 'gas-only') {
    badgeColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
    badgeText = t('card.gasOnly')
  }

  const riskColor = 
    park.risk === 'high' ? 'text-red-600 dark:text-red-400' :
    park.risk === 'moderate' ? 'text-yellow-600 dark:text-yellow-400' : 
    'text-emerald-600 dark:text-emerald-400'

  return (
    <div 
      onClick={onClick}
      className="p-3.5 sm:p-4 bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 hover:border-emerald-500/70 rounded-2xl cursor-pointer transition-all duration-150 active:scale-[0.985] group"
    >
      <div className="flex justify-between items-start gap-2">
        <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
          {park.name}
        </h3>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg shrink-0 ${badgeColor}`}>
          {badgeText}
        </span>
      </div>

      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center justify-between">
        <span>📍 {park.distance} {t('card.fromLocation')}</span>
        <span className="text-amber-500 font-medium">★ {park.rating || '4.0'}</span>
      </div>

      <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between text-[11px]">
        <span className="text-zinc-400">
          💬 {park.reviewCount || 0} {t('card.reviews')}
        </span>
        <span className={`font-semibold capitalize ${riskColor}`}>
          {t('card.risk')}: {park.risk}
        </span>
      </div>
    </div>
  )
}

export default ParkCard