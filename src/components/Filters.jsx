// src/components/Filters.jsx
import React from 'react'
import { useTranslation } from 'react-i18next'

function Filters({ filters, onChange, onReset }) {
  const { t } = useTranslation()

  const toggle = (key) => {
    onChange({ ...filters, [key]: !filters[key] })
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 text-sm shadow-sm transition-colors duration-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-zinc-900 dark:text-white">{t('filters.title')}</h2>
        <button 
          onClick={onReset}
          className="text-xs text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          {t('filters.reset')}
        </button>
      </div>

      {/* BBQ Filter */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">
          {t('filters.bbqType')}
        </div>
        <div className="space-y-2 text-zinc-800 dark:text-zinc-200">
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.charcoal} 
              onChange={() => toggle('charcoal')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>{t('filters.charcoal')}</span>
          </label>
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.gasOnly} 
              onChange={() => toggle('gasOnly')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>{t('filters.gasOnly')}</span>
          </label>
        </div>
      </div>

      {/* Verified Facilities */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">
          {t('filters.facilities')}
        </div>
        <div className="space-y-2 text-zinc-800 dark:text-zinc-200">
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.restroom} 
              onChange={() => toggle('restroom')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>{t('filters.washrooms')}</span>
          </label>

          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.playground} 
              onChange={() => toggle('playground')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>{t('filters.playground')}</span>
          </label>

          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.sports} 
              onChange={() => toggle('sports')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>{t('filters.sports')}</span>
          </label>

          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.dog} 
              onChange={() => toggle('dog')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>{t('filters.dog')}</span>
          </label>
        </div>
      </div>

      {/* Wildfire Risk */}
      <div>
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">
          {t('filters.wildfireRisk')}
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.riskLow} 
              onChange={() => toggle('riskLow')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t('filters.lowRisk')}</span>
          </label>
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.riskModerate} 
              onChange={() => toggle('riskModerate')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">{t('filters.moderate')}</span>
          </label>
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.riskHigh} 
              onChange={() => toggle('riskHigh')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-red-600 dark:text-red-400 font-medium">{t('filters.highRisk')}</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default Filters