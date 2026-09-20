import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../firebase' 
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'

// 🌟 App.jsx에서 보내준 isFavorite과 onToggleFavorite 프롭스 추가
export default function ParkModal({ park, onClose, onUpdate, userProfile, isFavorite, onToggleFavorite }) {
  const { t } = useTranslation()
  const [showRating, setShowRating] = useState(false)
  const [ratingValue, setRatingValue] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [hoverRating, setHoverRating] = useState(0)
  
  const [reviews, setReviews] = useState([])
  const [isLoading, setIsLoading] = useState(true)

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
        console.error("리뷰 불러오기 에러:", error)
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
    : '0.0' // 🌟 리뷰가 없을 때는 무조건 0.0으로 고정되도록 수정 완료!

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
      alert(t('modal.loginRequired', '리뷰를 작성하려면 로그인해 주세요!'))
      return
    }
    if (!reviewText.trim() && ratingValue === 0) return

    const newReviewData = {
      parkId: park.id,
      userName: userProfile.name,
      userPhoto: userProfile.picture,
      rating: ratingValue,
      content: reviewText.trim() || "Great spot!",
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
      console.error("리뷰 저장 에러:", error)
      alert(t('modal.reviewError', '리뷰 저장 중 문제가 발생했습니다.'))
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
        className="modal bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 w-full max-w-3xl max-h-[88vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 px-5 sm:px-8 py-4 sm:py-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white/95 dark:bg-zinc-950/95 backdrop-blur">
          <div className="pr-4">
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white truncate max-w-[240px] sm:max-w-md">
              {park.name}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 mt-0.5 sm:mt-1">
              📍 {park.distance} {t('modal.fromLocation')}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 -mr-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white flex items-center justify-center text-2xl active:scale-90 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-8 grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8 flex-1 text-zinc-800 dark:text-zinc-200">
          <div className="md:col-span-3 space-y-6 sm:space-y-8">
            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2.5 sm:mb-3">
                {t('modal.bbqRules')}
              </div>
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {park.bbq === 'charcoal' && (
                  <>
                    <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2 font-medium">
                      {t('modal.charcoalAllowed')}
                    </div>
                    <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2 font-medium">
                      {t('modal.gasAllowed')}
                    </div>
                  </>
                )}
                {park.bbq === 'gas-only' && (
                  <>
                    <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2 font-medium">
                      {t('modal.gasOnly')}
                    </div>
                    <div className="px-4 py-2 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2 font-medium">
                      {t('modal.charcoalProhibited')}
                    </div>
                  </>
                )}
                {park.bbq === 'none' && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2 font-medium">
                    {t('modal.noBbqAllowed')}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2.5 sm:mb-3">
                {t('modal.currentConditions')}
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-x-2">
                  <div className={`${riskInfo.color} px-4 sm:px-6 py-1 sm:py-1.5 rounded-2xl sm:rounded-3xl text-xs sm:text-sm font-bold flex items-center gap-x-1.5 shadow-sm`}>
                    ⚠️ {riskInfo.label}
                  </div>
                  <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('modal.liveSync')}</div>
                </div>
                <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {riskInfo.desc}
                </p>
              </div>
            </div>

            <div>
              <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2.5 sm:mb-3">
                {t('modal.facilitiesTitle')}
              </div>
              <div className="flex flex-wrap gap-2">
                {park.facilities && park.facilities.length > 0 ? (
                  park.facilities.map((fac, i) => (
                    <div key={i} className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs sm:text-sm flex items-center gap-x-2 text-zinc-800 dark:text-zinc-200">
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

          <div className="md:col-span-2 space-y-5 sm:space-y-6">
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] sm:text-xs text-zinc-500">{t('modal.overallRating')}</div>
                  <div className="text-4xl sm:text-6xl font-semibold tabular-nums mt-1 text-zinc-900 dark:text-white">{averageRating}</div>
                  <div className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t('modal.basedOnReviews', { count: reviewCount })}</div>
                </div>
                <div className="text-2xl sm:text-4xl text-amber-400">
                  {'★'.repeat(Math.min(5, Math.floor(parseFloat(averageRating))))}
                </div>
              </div>

              <button 
                onClick={() => setShowRating(true)}
                className="mt-4 sm:mt-6 w-full py-2.5 sm:py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 font-semibold rounded-2xl sm:rounded-3xl flex items-center justify-center gap-x-2 text-xs sm:text-sm transition-all shadow-sm"
              >
                {t('modal.ratePark')}
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col h-[260px] sm:h-[280px]">
              <div className="flex justify-between items-center mb-3">
                <div className="uppercase tracking-[1px] text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t('modal.communityNotes')}</div>
                <button 
                  onClick={() => setShowRating(true)} 
                  className="text-xs bg-emerald-100 dark:bg-emerald-900/80 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-2xl border border-emerald-300 dark:border-emerald-700/50"
                >
                  {t('modal.addNote')}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs sm:text-sm">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-xs animate-pulse">
                    {t('modal.loadingReviews', '리뷰 데이터를 불러오는 중...')}
                  </div>
                ) : reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {review.userPhoto ? (
                            <img src={review.userPhoto} alt="profile" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 bg-emerald-500 rounded-full text-white flex items-center justify-center text-[10px] font-bold">
                              {review.userName ? review.userName.charAt(0) : 'U'}
                            </div>
                          )}
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {review.userName || t('modal.anonymous', '익명 사용자')}
                          </span>
                        </div>
                        <span className="text-amber-400 text-xs">{'★'.repeat(review.rating || 5)}</span>
                      </div>
                      <p className="mt-1.5 text-zinc-600 dark:text-zinc-300 text-xs leading-snug whitespace-pre-wrap">{review.content}</p>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-zinc-500 text-xs whitespace-pre-line">
                    {t('modal.noReviews')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-8 py-3.5 sm:py-5 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur flex gap-3 sm:gap-x-4">
          <button 
            onClick={getDirections}
            className="flex-1 py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-500 font-semibold text-white rounded-2xl sm:rounded-3xl flex items-center justify-center gap-x-2 text-xs sm:text-sm active:scale-[0.985] transition-all shadow-lg shadow-emerald-950/20"
          >
            {t('modal.getDirections')}
          </button>
          
          {/* 🌟 Firebase와 연동된 즐겨찾기 버튼 (저장 상태에 따라 디자인 변경) */}
          <button 
            onClick={onToggleFavorite}
            className={`flex-1 py-3 sm:py-4 border font-semibold rounded-2xl sm:rounded-3xl flex items-center justify-center gap-x-2 text-xs sm:text-sm active:scale-[0.985] transition-all ${
              isFavorite 
                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/50' 
                : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span className="text-lg">{isFavorite ? '❤️' : '🤍'}</span>
            <span>{isFavorite ? t('modal.saved') : t('modal.saveFavorites')}</span>
    </button>
        </div>
      </div>

      {showRating && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4" onClick={() => setShowRating(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
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
              className="w-full h-24 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-2xl p-3.5 text-xs sm:text-sm text-zinc-900 dark:text-white focus:border-emerald-600 outline-none resize-none"
            />

            <div className="flex gap-x-3 mt-6">
              <button 
                onClick={() => setShowRating(false)} 
                className="flex-1 py-3 border border-zinc-300 dark:border-zinc-700 rounded-2xl sm:rounded-3xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {t('modal.cancel')}
              </button>
              <button 
                onClick={handleAddReview}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl sm:rounded-3xl font-semibold text-white text-xs sm:text-sm active:scale-95 transition-all"
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