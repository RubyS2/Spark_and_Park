import React from 'react'

export default function Filters({ filters, onChange, onReset }) {
  const handleCheckbox = (key) => {
    onChange({ ...filters, [key]: !filters[key] })
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sticky top-20">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-x-2 text-sm font-semibold">
          <span>⚙️</span> FILTERS
        </div>
        <button 
          onClick={onReset}
          className="text-xs px-3 py-1 hover:bg-zinc-800 rounded-2xl text-zinc-400 hover:text-white"
        >
          Reset all
        </button>
      </div>

      {/* BBQ Type */}
      <div className="mb-6">
        <div className="text-sm font-semibold mb-3 flex items-center gap-x-2">
          🔥 BBQ Type
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filters.charcoal} 
              onChange={() => handleCheckbox('charcoal')}
              className="w-4 h-4 accent-emerald-600" 
            />
            <span>Charcoal allowed</span>
          </label>
          <label className="flex items-center gap-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filters.gasOnly} 
              onChange={() => handleCheckbox('gasOnly')}
              className="w-4 h-4 accent-emerald-600" 
            />
            <span>Gas only</span>
          </label>
        </div>
      </div>

      {/* Facilities */}
      <div className="mb-6">
        <div className="text-sm font-semibold mb-3 flex items-center gap-x-2">
          🪑 Facilities
        </div>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          {[
            { key: 'restroom', label: 'Restroom' },
            { key: 'parking', label: 'Parking' },
            { key: 'picnic', label: 'Picnic tables' },
            { key: 'water', label: 'Water access' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filters[item.key]} 
                onChange={() => handleCheckbox(item.key)}
                className="w-4 h-4 accent-emerald-600" 
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Wildfire Risk */}
      <div>
        <div className="text-sm font-semibold mb-3 flex items-center gap-x-2">
          ⚠️ Wildfire Risk
        </div>
        <div className="space-y-2 text-sm">
          {[
            { key: 'riskLow', label: 'Low', color: 'emerald' },
            { key: 'riskModerate', label: 'Moderate', color: 'yellow' },
            { key: 'riskHigh', label: 'High', color: 'orange' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-x-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filters[item.key]} 
                onChange={() => handleCheckbox(item.key)}
                className="w-4 h-4 accent-emerald-600" 
              />
              <span className={`px-2.5 py-0.5 rounded-xl text-xs bg-${item.color}-900 text-${item.color}-300`}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-5 border-t border-zinc-800 text-[10px] text-zinc-500 leading-snug">
        Data synced from Vancouver Open Data Portal + BC Wildfire Service API
      </div>
    </div>
  )
}