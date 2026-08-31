import React from 'react'

function Filters({ filters, onChange, onReset }) {
  const toggle = (key) => {
    onChange({ ...filters, [key]: !filters[key] })
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-white">Filters</h2>
        <button 
          onClick={onReset}
          className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
        >
          Reset All
        </button>
      </div>

      {/* BBQ Filter: Charcoal allowed / Gas only */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
          BBQ Type
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.charcoal} 
              onChange={() => toggle('charcoal')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>🔥 Charcoal allowed</span>
          </label>
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.gasOnly} 
              onChange={() => toggle('gasOnly')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>⛽ Gas only</span>
          </label>
        </div>
      </div>

      {/* Verified Open Data Facilities */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
          Facilities (Verified)
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.restroom} 
              onChange={() => toggle('restroom')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>🚻 Washrooms</span>
          </label>

          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.playground} 
              onChange={() => toggle('playground')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>🛝 Playground</span>
          </label>

          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.sports} 
              onChange={() => toggle('sports')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>⚽ Sports Fields / Courts</span>
          </label>

          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.dog} 
              onChange={() => toggle('dog')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span>🐕 Dog Off-Leash Area</span>
          </label>
        </div>
      </div>

      {/* Wildfire Risk */}
      <div>
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
          Wildfire Risk Level
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.riskLow} 
              onChange={() => toggle('riskLow')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-emerald-400">● Low Risk</span>
          </label>
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.riskModerate} 
              onChange={() => toggle('riskModerate')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-yellow-400">● Moderate</span>
          </label>
          <label className="flex items-center gap-x-2.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={filters.riskHigh} 
              onChange={() => toggle('riskHigh')}
              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-red-400">● High / Extreme</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default Filters