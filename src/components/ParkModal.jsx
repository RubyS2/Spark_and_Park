import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../firebase' 
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'

export default function ParkModal({ park, onClose, onUpdate, userProfile, isFavorite, onToggleFavorite }) {
  const { t, i18n } = useTranslation()
  const [showRating, setShowRating] = useState(false)
  const [ratingValue, setRatingValue] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [hoverRating, setHoverRating] = useState(0)
  
  const [reviews, setReviews] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [translatedReviews, setTranslatedReviews] = useState({}) 
  const [isTranslating, setIsTranslating] = useState({})

  useEffect(() => {
    const fetchReviews = async () => {
      if (!park) return
      setIsLoading(true)
      try {
        const q = query(
          collection(db, 'reviews'),
          where('parkId', '==', park.id)
        )
        const querySnapshot = await getDocs(q)
        
        const fetchedReviews = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        fetchedReviews.sort((a, b) => b.createdAt - a.createdAt)
        
        setReviews(fetchedReviews)
      } catch (error) {
        console.error("Error fetching reviews:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviews()
  }, [park])

  if (!park) return null

  const reviewCount = reviews.length
  const averageRating = reviewCount > 0 
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviewCount).toFixed(1)
    : '0.0' 

  const renderStars = (ratingStr) => {
    const num = Math.min(5, Math.floor(parseFloat(ratingStr)))
    return (
      <>
        <span className="text-amber-400 tracking-wider">{'★'.repeat(num)}</span>
        <span className="text-zinc-200 dark:text-zinc-700 tracking-wider">{'★'.repeat(5 - num)}</span>
      </>
    )
  }

  const getRiskInfo = (risk) => {
    if (risk === 'low') {
      return { 
        label: t('modal.riskLevel', { level: 'LOW' }), 
        color: 'bg-emerald-600 text-white', 
        desc: t('modal.riskDescLow') 
      }
    }
    if (risk === 'moderate') {
      return { 
        label: t('modal.riskLevel', { level: 'MODERATE' }), 
        color: 'bg-yellow-500 text-black', 
        desc: t('modal.riskDescModerate') 
      }
    }
    return { 
      label: t('modal.riskLevel', { level: 'HIGH' }), 
      color: 'bg-red-600 text-white', 
      desc: t('modal.riskDescHigh') 
    }
  }

  const riskInfo = getRiskInfo(park.risk)

  const handleAddReview = async () => {
    if (!userProfile) {
      alert(t('modal.loginRequired'))
      return
    }
    if (!reviewText.trim() && ratingValue === 0) return

    const newReviewData = {
      parkId: park.id,
      userId: userProfile.sub,
      userName: userProfile.name,
      userPhoto: userProfile.picture,
      rating: ratingValue,
      content: reviewText.trim() || t('modal.defaultReview'),
      createdAt: Date.now()
    }

    try {
      const docRef = await addDoc(collection(db, 'reviews'), newReviewData)
      const addedReview = { id: docRef.id, ...newReviewData }
      setReviews([addedReview, ...reviews])
      
      const updatedPark = {
        ...park,
        reviewCount: reviewCount + 1,
        rating: (((parseFloat(averageRating) * reviewCount) + ratingValue) / (reviewCount + 1)).toFixed(1)
      }
      onUpdate(updatedPark)
      setShowRating(false)
      setReviewText('')
      setRatingValue(5)
    } catch (error) {
      console.error("Error saving review:", error)
      alert(t('modal.reviewError'))
    }
  }

  const handleTranslate = async (reviewId, text) => {
    if (translatedReviews[reviewId]) {
      setTranslatedReviews(prev => {
        const newState = { ...prev }
        delete newState[reviewId]
        return newState
      })
      return
    }

    setIsTranslating(prev => ({ ...prev, [reviewId]: true }))
    
    try {
      const systemLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'en'
      const targetLang = systemLang.split('-')[0] 
      
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      const res = await fetch(url)
      const data = await res.json()
      
      const translatedText = data[0].map(item => item[0]).join('')
      setTranslatedReviews(prev => ({ ...prev, [reviewId]: translatedText }))
    } catch (error) {
      console.error("Translation error:", error)
      alert(t('modal.translateError'))
    } finally {
      setIsTranslating(prev => ({ ...prev, [reviewId]: false }))
    }
  }

  const getDirections = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lng}`, '_blank')
  }

  const getFacilityName = (fac) => {
    switch (fac) {
      case 'restroom': return t('modal.facWashrooms')
      case 'playground': return t('modal.facPlayground')
      case 'sports': return t('modal.facSports')
      case 'dog': return t('modal.facDog')
      case 'parking': return t('modal.facParking')
      case 'picnic': return t('modal.facPicnic')
      case 'water': return t('modal.facWater')
      default: return fac
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all"
      onClick={onClose}
    >
      <div 
        className="modal bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 w-full max-w-4xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 z-20 px-5 sm:px-8 py-4 sm:py-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950">
          <div className="pr-4 flex-1 min-w-0">
            <h2 className="text-xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white truncate">
              {park.name}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 mt-1 truncate">
              📍 {park.distance} {t('modal.fromLocation')}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white flex items-center justify-center text-2xl active:scale-90 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="overflow-x-hidden overflow-y-auto p-5 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 flex-1 text-zinc-800 dark:text-zinc-200">
          
          <div className="space-y-6 sm:space-y-8 min-w-0">
            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
                {t('modal.bbqRules')}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {park.bbq === 'charcoal' && (
                  <>
                    <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-medium shrink-0">
                      {t('modal.charcoalAllowed')}
                    </div>
                    <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-medium shrink-0">
                      {t('modal.gasAllowed')}
                    </div>
                  </>
                )}
                {park.bbq === 'gas-only' && (
                  <>
                    <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/60 rounded-xl text-xs font-medium shrink-0">
                      {t('modal.gasOnly')}
                    </div>
                    <div className="px-4 py-2 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-xl text-xs font-medium shrink-0">
                      {t('modal.charcoalProhibited')}
                    </div>
                  </>
                )}
                {park.bbq === 'none' && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-xl text-xs font-medium shrink-0">
                    {t('modal.noBbqAllowed')}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
                {t('modal.currentConditions')}
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className={`${riskInfo.color} px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-x-1.5 shrink-0`}>
                    ⚠️ {riskInfo.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{t('modal.liveSync')}</div>
                </div>
                <p className="mt-4 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {riskInfo.desc}
                </p>
              </div>
            </div>

            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
                {t('modal.facilitiesTitle')}
              </div>
              <div className="flex flex-wrap gap-2">
                {park.facilities && park.facilities.length > 0 ? (
                  park.facilities.map((fac, i) => (
                    <div key={i} className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs flex items-center gap-x-2 text-zinc-800 dark:text-zinc-200 shrink-0">
                      {fac === 'restroom' && '🚻'} 
                      {fac === 'playground' && '🛝'} 
                      {fac === 'sports' && '⚽'} 
                      {fac === 'dog' && '🐕'} 
                      {fac === 'parking' && '🅿️'} 
                      {fac === 'picnic' && '🪑'} 
                      {fac === 'water' && '💧'} 
                      <span className="font-medium">{getFacilityName(fac)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-500 py-1">{t('modal.facNone')}</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] sm:text-xs text-zinc-500 font-medium tracking-wide uppercase">{t('modal.overallRating')}</div>
                  <div className="text-4xl sm:text-5xl font-bold tabular-nums mt-1 text-zinc-900 dark:text-white leading-none">
                    {averageRating}
                  </div>
                  <div className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {t('modal.basedOnReviews', { count: reviewCount })}
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl flex gap-x-0.5">
                  {renderStars(averageRating)}
                </div>
              </div>

              <button 
                onClick={() => setShowRating(true)}
                className="mt-5 w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.98] font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm"
              >
                {t('modal.ratePark')}
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col flex-1 min-h-[300px]">
              <div className="flex justify-between items-center mb-4">
                <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t('modal.communityNotes')}</div>
                <button 
                  onClick={() => setShowRating(true)} 
                  className="text-[11px] sm:text-xs bg-emerald-100 dark:bg-emerald-900/80 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-300 dark:border-emerald-700/50 font-medium transition-colors"
                >
                  {t('modal.addNote')}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 text-xs sm:text-sm">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-xs animate-pulse">
                    {t('modal.loadingReviews')}
                  </div>
                ) : reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          {review.userPhoto ? (
                            <img src={review.userPhoto} alt="profile" className="w-6 h-6 rounded-full object-cover shadow-sm" />
                          ) : (
                            <div className="w-6 h-6 bg-emerald-500 rounded-full text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                              {review.userName ? review.userName.charAt(0) : 'U'}
                            </div>
                          )}
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {review.userName || t('modal.anonymous', '익명 사용자')}
                          </span>
                        </div>
                        <div className="flex gap-x-0.5 text-[10px] sm:text-xs">
                          {renderStars(review.rating || 5)}
                        </div>
                      </div>
                      
                      <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap break-words">{review.content}</p>
                      
                      {isTranslating[review.id] && (
                        <div className="mt-3 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-[11px] text-zinc-500 animate-pulse border border-zinc-100 dark:border-zinc-800">
                          {t('modal.translating')}
                        </div>
                      )}

                      {translatedReviews[review.id] && (
                        <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl relative transition-all">
                          <div className="flex items-center gap-x-1.5 mb-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            <i className="fa-brands fa-google"></i> {t('modal.translated')}
                          </div>
                          <p className="text-zinc-700 dark:text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap break-words">
                            {translatedReviews[review.id]}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap justify-between items-end mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/50 gap-2">
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                          {new Date(review.createdAt).toLocaleDateString(i18n.language)}
                        </div>
                        
                        <button 
                          onClick={() => handleTranslate(review.id, review.content)}
                          disabled={isTranslating[review.id]}
                          className="text-[10px] sm:text-[11px] font-medium flex items-center gap-x-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-3 py-1.5 rounded-full border border-blue-200/60 dark:border-blue-800/60 disabled:opacity-50 shrink-0 whitespace-nowrap"
                        >
                          <span className="text-xs">🌐</span> 
                          {translatedReviews[review.id] ? t('modal.hideTranslate') : t('modal.translate')}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-2">
                    <span className="text-3xl mb-1">📝</span>
                    <span className="text-xs whitespace-pre-line leading-relaxed">{t('modal.noReviews')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-5 sm:px-8 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-row gap-3 sm:gap-4">
          <button 
            onClick={getDirections}
            className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 font-semibold text-white rounded-xl flex items-center justify-center gap-x-2 text-xs sm:text-sm active:scale-[0.985] transition-all shadow-md shadow-emerald-900/10 shrink-0"
          >
            {t('modal.getDirections')}
          </button>
          
          <button 
            onClick={onToggleFavorite}
            className={`flex-1 py-3.5 border font-semibold rounded-xl flex items-center justify-center gap-x-2 text-xs sm:text-sm active:scale-[0.985] transition-all shrink-0 ${
              isFavorite 
                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/50' 
                : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span className="text-base sm:text-lg">{isFavorite ? '❤️' : '🤍'}</span>
            <span>{isFavorite ? t('modal.saved') : t('modal.saveFavorites')}</span>
          </button>
        </div>
      </div>

      {showRating && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4" onClick={() => setShowRating(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white truncate">
              {t('modal.rateTitle', { name: park.name })}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {t('modal.rateSubtitle')}
            </p>

            <div className="flex justify-center gap-x-2 my-6 sm:my-8 text-4xl sm:text-5xl">
              {[1, 2, 3, 4, 5].map(star => (
                <span 
                  key={star}
                  onClick={() => setRatingValue(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className={`cursor-pointer transition-all ${ (hoverRating || ratingValue) >= star ? 'text-amber-400 scale-110' : 'text-zinc-300 dark:text-zinc-700' }`}
                >
                  ★
                </span>
              ))}
            </div>

            <textarea 
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={t('modal.ratePlaceholder')}
              className="w-full h-24 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3.5 text-xs sm:text-sm text-zinc-900 dark:text-white focus:border-emerald-600 outline-none resize-none"
            />

            <div className="flex gap-x-3 mt-6">
              <button 
                onClick={() => setShowRating(false)} 
                className="flex-1 py-3.5 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                {t('modal.cancel')}
              </button>
              <button 
                onClick={handleAddReview}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-white text-xs sm:text-sm active:scale-[0.98] transition-transform shadow-md"
              >
                {t('modal.submitReview')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}