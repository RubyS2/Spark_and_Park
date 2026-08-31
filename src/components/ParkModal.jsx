import React, { useState } from 'react'

export default function ParkModal({ park, onClose, onUpdate }) {
  const [showRating, setShowRating] = useState(false)
  const [ratingValue, setRatingValue] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [hoverRating, setHoverRating] = useState(0)

  if (!park) return null

  const getRiskInfo = (risk) => {
    if (risk === 'low') return { 
      label: 'LOW', 
      color: 'bg-emerald-600', 
      desc: 'Barbecues are permitted. Please follow all safety guidelines.' 
    }
    if (risk === 'moderate') return { 
      label: 'MODERATE', 
      color: 'bg-yellow-500 text-black', 
      desc: 'Use caution. Gas grills preferred. Never leave fire unattended.' 
    }
    return { 
      label: 'HIGH', 
      color: 'bg-orange-600', 
      desc: 'High fire danger. Gas stoves only. Avoid charcoal. Check local bylaws.' 
    }
  }

  const riskInfo = getRiskInfo(park.risk)

  const handleAddReview = () => {
    if (!reviewText.trim() && ratingValue === 0) return

    const newReview = {
      id: Date.now(),
      user: "You",
      text: reviewText.trim() || "Great spot!",
      stars: ratingValue,
      time: "just now"
    }

    const updatedPark = {
      ...park,
      reviews: [newReview, ...(park.reviews || [])],
      reviewCount: (park.reviewCount || 0) + 1,
      rating: (((parseFloat(park.rating) || 4) * (park.reviewCount || 0) + ratingValue) / ((park.reviewCount || 0) + 1)).toFixed(1)
    }

    onUpdate(updatedPark)
    setShowRating(false)
    setReviewText('')
    setRatingValue(5)
  }

  const getDirections = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lng}`, '_blank')
  }

  const saveToFavorites = () => {
    const saved = JSON.parse(localStorage.getItem('sparkParkFavorites') || '[]')
    if (!saved.includes(park.id)) {
      saved.push(park.id)
      localStorage.setItem('sparkParkFavorites', JSON.stringify(saved))
      alert(`${park.name} saved to favorites!`)
    } else {
      alert("Already in your favorites")
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all"
      onClick={onClose}
    >
      <div 
        className="modal bg-zinc-900 border border-zinc-750 w-full max-w-3xl max-h-[88vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header: 모바일 스크롤 시에도 최상단에 고정 */}
        <div className="sticky top-0 z-20 px-5 sm:px-8 py-4 sm:py-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/95 backdrop-blur">
          <div className="pr-4">
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-semibold tracking-tight truncate max-w-[240px] sm:max-w-md">
              {park.name}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-400 mt-0.5 sm:mt-1">
              {park.distance} from your location
            </p>
          </div>
          
          {/* 모바일/PC 공용 대형 터치 닫기 버튼 */}
          <button 
            onClick={onClose} 
            className="w-10 h-10 -mr-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center text-2xl active:scale-90 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content Body: 세로 스크롤 영역 */}
        <div className="overflow-y-auto p-5 sm:p-8 grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8 flex-1">
          {/* Left: Rules + Conditions + Facilities */}
          <div className="md:col-span-3 space-y-6 sm:space-y-8">
            {/* BBQ Rules */}
            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-400 mb-2.5 sm:mb-3">
                BBQ RULES
              </div>
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {park.bbq === 'charcoal' && (
                  <>
                    <div className="px-4 py-2 bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2">
                      🔥 Charcoal allowed
                    </div>
                    <div className="px-4 py-2 bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2">
                      ⛽ Gas allowed
                    </div>
                  </>
                )}
                {park.bbq === 'gas-only' && (
                  <>
                    <div className="px-4 py-2 bg-yellow-950 text-yellow-300 border border-yellow-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2">
                      ⛽ Gas only
                    </div>
                    <div className="px-4 py-2 bg-red-950 text-red-300 border border-red-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2">
                      🚫 Charcoal prohibited
                    </div>
                  </>
                )}
                {park.bbq === 'none' && (
                  <div className="px-4 py-2 bg-red-950 text-red-300 border border-red-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2">
                    🚫 No barbecues allowed
                  </div>
                )}
              </div>
            </div>

            {/* Current Conditions */}
            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-400 mb-2.5 sm:mb-3">
                CURRENT CONDITIONS
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-x-2">
                  <div className={`${riskInfo.color} px-4 sm:px-6 py-1 sm:py-1.5 rounded-2xl sm:rounded-3xl text-xs sm:text-sm font-bold flex items-center gap-x-1.5`}>
                    ⚠️ {riskInfo.label} RISK
                  </div>
                  <div className="text-[11px] sm:text-xs text-zinc-400">BCWS Real-time Sync</div>
                </div>
                <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {riskInfo.desc}
                </p>
              </div>
            </div>

            {/* Facilities */}
            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-400 mb-2.5 sm:mb-3">
                FACILITIES (VERIFIED)
              </div>
              <div className="flex flex-wrap gap-2">
                {park.facilities && park.facilities.length > 0 ? (
                  park.facilities.map((fac, i) => (
                    <div key={i} className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-zinc-800/80 border border-zinc-700 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2 text-zinc-200">
                      {fac === 'restroom' && '🚻'} 
                      {fac === 'playground' && '🛝'} 
                      {fac === 'sports' && '⚽'} 
                      {fac === 'dog' && '🐕'} 
                      {fac === 'parking' && '🅿️'} 
                      {fac === 'picnic' && '🪑'} 
                      {fac === 'water' && '💧'} 
                      <span className="capitalize">
                        {fac === 'restroom' ? 'Washrooms' :
                         fac === 'playground' ? 'Playground' :
                         fac === 'sports' ? 'Sports Field' :
                         fac === 'dog' ? 'Dog Off-Leash' : fac}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-500 py-1">Basic park area (No additional facilities registered)</div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Rating + Reviews */}
          <div className="md:col-span-2 space-y-5 sm:space-y-6">
            {/* Rating Summary */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 sm:p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] sm:text-xs text-zinc-500">OVERALL RATING</div>
                  <div className="text-4xl sm:text-6xl font-semibold tabular-nums mt-1">{park.rating || '4.0'}</div>
                  <div className="text-[10px] sm:text-xs text-zinc-400 mt-0.5">based on {park.reviewCount || 0} reviews</div>
                </div>
                <div className="text-2xl sm:text-4xl text-amber-400">
                  {'★'.repeat(Math.min(5, Math.floor(park.rating || 4)))}
                </div>
              </div>

              <button 
                onClick={() => setShowRating(true)}
                className="mt-4 sm:mt-6 w-full py-2.5 sm:py-3 bg-white text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 font-semibold rounded-2xl sm:rounded-3xl flex items-center justify-center gap-x-2 text-xs sm:text-sm active:scale-95 transition-all"
              >
                ⭐ Rate this park
              </button>
            </div>

            {/* Community Notes */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col h-[260px] sm:h-[280px]">
              <div className="flex justify-between items-center mb-3">
                <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-400">COMMUNITY NOTES</div>
                <button 
                  onClick={() => setShowRating(true)} 
                  className="text-xs bg-emerald-900/80 hover:bg-emerald-800 text-emerald-300 px-3 py-1 rounded-2xl border border-emerald-700/50"
                >
                  + Add note
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs sm:text-sm">
                {park.reviews && park.reviews.length > 0 ? (
                  park.reviews.map((review, idx) => (
                    <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-zinc-200">{review.user || review.author}</span>
                        <span className="text-amber-400 text-xs">{'★'.repeat(review.stars || review.rating || 5)}</span>
                      </div>
                      <p className="mt-1.5 text-zinc-300 text-xs leading-snug">{review.text}</p>
                      <div className="text-[10px] text-zinc-500 mt-2">{review.time || review.date}</div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-zinc-500 text-xs">
                    No reviews yet.<br />Be the first to share your experience!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-8 py-3.5 sm:py-5 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur flex gap-3 sm:gap-x-4">
          <button 
            onClick={getDirections}
            className="flex-1 py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-500 font-semibold text-white rounded-2xl sm:rounded-3xl flex items-center justify-center gap-x-2 text-xs sm:text-sm active:scale-[0.985] transition-all shadow-lg shadow-emerald-950/40"
          >
            🧭 Get Directions
          </button>
          <button 
            onClick={saveToFavorites}
            className="flex-1 py-3 sm:py-4 border border-zinc-700 hover:bg-zinc-800 font-semibold text-zinc-300 rounded-2xl sm:rounded-3xl flex items-center justify-center gap-x-2 text-xs sm:text-sm active:scale-[0.985] transition-all"
          >
            🔖 Save to Favorites
          </button>
        </div>
      </div>

      {/* Rating Popup Modal */}
      {showRating && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4" onClick={() => setShowRating(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl sm:text-2xl font-semibold text-white">Rate {park.name}</h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">Your feedback helps others</p>

            <div className="flex justify-center gap-x-2 my-6 sm:my-8 text-4xl sm:text-5xl">
              {[1, 2, 3, 4, 5].map(star => (
                <span 
                  key={star}
                  onClick={() => setRatingValue(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className={`cursor-pointer transition-all ${ (hoverRating || ratingValue) >= star ? 'text-amber-400 scale-110' : 'text-zinc-700' }`}
                >
                  ★
                </span>
              ))}
            </div>

            <textarea 
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share crowd level, cleanliness, or tips... (optional)"
              className="w-full h-24 bg-zinc-950 border border-zinc-700 rounded-2xl p-3.5 text-xs sm:text-sm text-white focus:border-emerald-600 outline-none resize-none"
            />

            <div className="flex gap-x-3 mt-6">
              <button 
                onClick={() => setShowRating(false)} 
                className="flex-1 py-3 border border-zinc-700 rounded-2xl sm:rounded-3xl hover:bg-zinc-800 text-xs sm:text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddReview}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl sm:rounded-3xl font-semibold text-white text-xs sm:text-sm active:scale-95 transition-all"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}