import React, { useState } from 'react'

export default function ParkModal({ park, onClose, onUpdate }) {
  const [showRating, setShowRating] = useState(false)
  const [ratingValue, setRatingValue] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [hoverRating, setHoverRating] = useState(0)

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
      rating: (((park.rating || 4) * (park.reviewCount || 0) + ratingValue) / ((park.reviewCount || 0) + 1)).toFixed(1)
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="modal bg-zinc-900 border border-zinc-700 w-full max-w-3xl rounded-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-zinc-800 flex justify-between items-start bg-zinc-950">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight">{park.name}</h2>
            <p className="text-emerald-400 mt-1">{park.distance} from your location</p>
          </div>
          <button onClick={onClose} className="text-3xl text-zinc-400 hover:text-white">×</button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Left: Rules + Conditions */}
          <div className="md:col-span-3 space-y-8">
            {/* BBQ Rules */}
            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-400 mb-3">BBQ RULES</div>
              <div className="flex flex-wrap gap-3">
                {park.bbq === 'charcoal' && (
                  <>
                    <div className="px-5 py-2 bg-emerald-900 text-emerald-300 rounded-3xl text-sm flex items-center gap-x-2">
                      🔥 Charcoal allowed
                    </div>
                    <div className="px-5 py-2 bg-emerald-900 text-emerald-300 rounded-3xl text-sm flex items-center gap-x-2">
                      ⛽ Gas allowed
                    </div>
                  </>
                )}
                {park.bbq === 'gas-only' && (
                  <>
                    <div className="px-5 py-2 bg-yellow-900 text-yellow-300 rounded-3xl text-sm flex items-center gap-x-2">
                      ⛽ Gas only
                    </div>
                    <div className="px-5 py-2 bg-red-900 text-red-300 rounded-3xl text-sm flex items-center gap-x-2">
                      🚫 Charcoal prohibited
                    </div>
                  </>
                )}
                {park.bbq === 'none' && (
                  <div className="px-5 py-2 bg-red-900 text-red-300 rounded-3xl text-sm flex items-center gap-x-2">
                    🚫 No barbecues allowed
                  </div>
                )}
              </div>
            </div>

            {/* Current Conditions */}
            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-400 mb-3">CURRENT CONDITIONS</div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-x-4">
                  <div className={`${riskInfo.color} px-6 py-1.5 rounded-3xl text-sm font-bold flex items-center gap-x-2`}>
                    ⚠️ {riskInfo.label} RISK
                  </div>
                  <div className="text-xs text-zinc-400">Updated: today at 2:30 PM</div>
                </div>
                <p className="mt-4 text-sm text-zinc-300 leading-relaxed">{riskInfo.desc}</p>
              </div>
            </div>

            {/* Facilities */}
            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-400 mb-3">FACILITIES</div>
              <div className="flex flex-wrap gap-2">
                {park.facilities.map((fac, i) => (
                  <div key={i} className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-2xl text-sm flex items-center gap-x-2">
                    {fac === 'restroom' && '🚻'} 
                    {fac === 'parking' && '🅿️'} 
                    {fac === 'picnic' && '🪑'} 
                    {fac === 'water' && '💧'} 
                    <span className="capitalize">{fac}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Rating + Reviews */}
          <div className="md:col-span-2 space-y-6">
            {/* Rating Summary */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-zinc-500">OVERALL RATING</div>
                  <div className="text-6xl font-semibold tabular-nums mt-1">{park.rating}</div>
                  <div className="text-xs text-zinc-400">based on {park.reviewCount} reviews</div>
                </div>
                <div className="text-4xl text-amber-400">{'★'.repeat(Math.floor(park.rating))}</div>
              </div>

              <button 
                onClick={() => setShowRating(true)}
                className="mt-6 w-full py-3 bg-white text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 font-semibold rounded-3xl flex items-center justify-center gap-x-2 text-sm transition-all"
              >
                ⭐ Rate this park
              </button>
            </div>

            {/* Community Notes */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col h-[280px]">
              <div className="flex justify-between items-center mb-4">
                <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-400">COMMUNITY NOTES</div>
                <button onClick={() => setShowRating(true)} className="text-xs bg-emerald-900 hover:bg-emerald-800 px-3 py-1 rounded-2xl">+ Add note</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-sm custom-scroll">
                {park.reviews && park.reviews.length > 0 ? (
                  park.reviews.map((review, idx) => (
                    <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      <div className="flex justify-between">
                        <span className="font-medium">{review.user}</span>
                        <span className="text-amber-400">{'★'.repeat(review.stars)}</span>
                      </div>
                      <p className="mt-2 text-zinc-300 text-sm leading-snug">{review.text}</p>
                      <div className="text-[10px] text-zinc-500 mt-3">{review.time}</div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-zinc-500 text-sm">
                    No reviews yet.<br />Be the first to share your experience!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 border-t border-zinc-800 bg-zinc-950 flex gap-x-4">
          <button 
            onClick={getDirections}
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-3xl flex items-center justify-center gap-x-2 active:scale-[0.985] transition-all"
          >
            🧭 Get Directions
          </button>
          <button 
            onClick={saveToFavorites}
            className="flex-1 py-4 border border-zinc-700 hover:bg-zinc-800 font-semibold rounded-3xl flex items-center justify-center gap-x-2 active:scale-[0.985] transition-all"
          >
            🔖 Save to Favorites
          </button>
        </div>
      </div>

      {/* Rating Popup */}
      {showRating && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center" onClick={() => setShowRating(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-semibold">Rate {park.name}</h3>
            <p className="text-sm text-zinc-400 mt-1">Your feedback helps others</p>

            <div className="flex justify-center gap-x-2 my-8 text-5xl">
              {[1,2,3,4,5].map(star => (
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
              placeholder="Share your experience... (optional)"
              className="w-full h-24 bg-zinc-950 border border-zinc-700 rounded-2xl p-4 text-sm resize-y focus:border-emerald-600 outline-none"
            />

            <div className="flex gap-x-3 mt-6">
              <button onClick={() => setShowRating(false)} className="flex-1 py-3 border border-zinc-700 rounded-3xl hover:bg-zinc-800">Cancel</button>
              <button 
                onClick={handleAddReview}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-3xl font-semibold"
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