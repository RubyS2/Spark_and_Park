import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ParkModal from './components/ParkModal'
import Filters from './components/Filters'
import ParkCard from './components/ParkCard'
import { initialParks } from './data/parks'
import { getVancouverFireRisk, fetchVancouverParks } from './data/fireService'
import { getGoogleMapsDirectionsUrl, calculateDistanceKm } from './utils/geoUtils'
import { useGoogleLogin } from '@react-oauth/google'
import { db } from './firebase'
import { collection, getDocs, doc, getDoc, setDoc, query, where } from 'firebase/firestore'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const userLocationIcon = L.divIcon({
  className: 'user-marker',
  html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #3b82f6;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
})

const fetchAndMergeReviews = async (parksData) => {
  try {
    const snapshot = await getDocs(collection(db, 'reviews'))
    const aggregates = {}
    
    snapshot.forEach(doc => {
      const data = doc.data()
      const pid = data.parkId
      if (!aggregates[pid]) {
        aggregates[pid] = { sum: 0, count: 0 }
      }
      aggregates[pid].sum += data.rating
      aggregates[pid].count += 1
    })

    return parksData.map(park => {
      const agg = aggregates[park.id]
      if (agg) {
        return {
          ...park,
          reviewCount: agg.count,
          rating: (agg.sum / agg.count).toFixed(1)
        }
      }
      return { ...park, reviewCount: 0, rating: '0.0' }
    })
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return parksData 
  }
}

function App() {
  const { t, i18n } = useTranslation()
  const [parks, setParks] = useState([])
  const [filteredParks, setFilteredParks] = useState([])
  const [isParksLoading, setIsParksLoading] = useState(true)
  const [selectedPark, setSelectedPark] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [userLocation, setUserLocation] = useState({ lat: 49.2827, lng: -123.1207, isRealGps: false, label: 'Downtown Vancouver' })
  const [currentFireRisk, setCurrentFireRisk] = useState({ riskLevel: 'moderate', rawDesc: 'Loading...', updatedAt: '' })

  const [userProfile, setUserProfile] = useState(() => {
    const savedUser = localStorage.getItem('sparkUser')
    return savedUser ? JSON.parse(savedUser) : null
  })
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('sparkUser')
  })
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false) // 모달 제어용 상태

  const [viewMode, setViewMode] = useState('all') 
  const [favoriteParkIds, setFavoriteParkIds] = useState([])
  const [myReviewedParkIds, setMyReviewedParkIds] = useState([])

  useEffect(() => {
    const fetchUserData = async () => {
      if (userProfile?.sub) {
        try {
          const docRef = doc(db, 'userFavorites', userProfile.sub)
          const docSnap = await getDoc(docRef)
          if (docSnap.exists()) {
            setFavoriteParkIds(docSnap.data().parks || [])
          } else {
            setFavoriteParkIds([])
          }
        } catch (error) {
          console.error("Error fetching favorites:", error)
        }

        try {
          const q = query(collection(db, 'reviews'), where('userId', '==', userProfile.sub))
          const querySnapshot = await getDocs(q)
          const parkIds = querySnapshot.docs.map(doc => doc.data().parkId)
          setMyReviewedParkIds([...new Set(parkIds)])
        } catch (error) {
          console.error("Error fetching my reviews:", error)
        }
      } else {
        setFavoriteParkIds([])
        setMyReviewedParkIds([])
        setViewMode('all')
      }
    }
    fetchUserData()
  }, [userProfile])

  const toggleFavorite = async (parkId) => {
    if (!userProfile) {
      alert(t('modal.loginRequired'))
      return
    }
    const isFav = favoriteParkIds.includes(parkId)
    const newFavs = isFav ? favoriteParkIds.filter(id => id !== parkId) : [...favoriteParkIds, parkId]
    setFavoriteParkIds(newFavs)

    try {
      await setDoc(doc(db, 'userFavorites', userProfile.sub), { parks: newFavs })
    } catch (error) {
      console.error("Error saving favorites:", error)
      alert(t('nav.favUpdateError', '즐겨찾기 업데이트 중 오류가 발생했습니다.'))
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const data = await res.json()
        setUserProfile(data)
        setIsLoggedIn(true)
        localStorage.setItem('sparkUser', JSON.stringify(data))
      } catch (err) {
        console.error("Failed to fetch user info", err)
      }
    },
    onError: (error) => console.error('Login Failed:', error)
  })

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserProfile(null)
    setIsDropdownOpen(false)
    setViewMode('all')
    localStorage.removeItem('sparkUser')
  }

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) return savedTheme === 'dark'
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])

  const toggleDarkMode = () => setIsDarkMode(prev => !prev)

  const [filters, setFilters] = useState({
    charcoal: true,
    gasOnly: true,
    restroom: false,
    playground: false,
    sports: false,
    dog: false,
    riskLow: true,
    riskModerate: true,
    riskHigh: true,
  })

  const changeLanguage = (lng) => i18n.changeLanguage(lng)

  useEffect(() => {
    async function init() {
      const fireData = await getVancouverFireRisk()
      setCurrentFireRisk(fireData)
      let currentPos = { lat: 49.2827, lng: -123.1207, isRealGps: false, label: 'Downtown Vancouver' }

      const loadParksWithReviews = async (riskLevel, pos) => {
        setIsParksLoading(true) 
        const apiParks = await fetchVancouverParks(riskLevel, pos)
        if (apiParks) {
          const mergedParks = await fetchAndMergeReviews(apiParks)
          setParks(mergedParks)
        }
        setIsParksLoading(false) 
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const gpsLat = pos.coords.latitude
            const gpsLng = pos.coords.longitude
            const distFromVanc = calculateDistanceKm(gpsLat, gpsLng, 49.2827, -123.1207)
            currentPos = {
              lat: gpsLat,
              lng: gpsLng,
              isRealGps: true,
              label: distFromVanc > 100 ? `Real GPS (${distFromVanc.toLocaleString()}km)` : 'Near Vancouver'
            }
            setUserLocation(currentPos)
            await loadParksWithReviews(fireData.riskLevel, currentPos)
          },
          async (err) => {
            console.warn("GPS Access Denied -> Using Downtown Default", err)
            await loadParksWithReviews(fireData.riskLevel, currentPos)
          },
          { enableHighAccuracy: true, timeout: 8000 }
        )
      } else {
        await loadParksWithReviews(fireData.riskLevel, currentPos)
      }
    }
    init()
  }, [])

  useEffect(() => {
    let result = parks

    if (viewMode === 'favorites') result = result.filter(p => favoriteParkIds.includes(p.id))
    else if (viewMode === 'reviews') result = result.filter(p => myReviewedParkIds.includes(p.id))

    if (searchTerm) {
      result = result.filter(p => 
        (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.neighbourhood && p.neighbourhood.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    result = result.filter(p => {
      if (p.bbq === 'charcoal' && !filters.charcoal) return false
      if (p.bbq === 'gas-only' && !filters.gasOnly) return false
      return true
    })

    if (filters.restroom) result = result.filter(p => p.facilities?.includes('restroom'))
    if (filters.playground) result = result.filter(p => p.facilities?.includes('playground'))
    if (filters.sports) result = result.filter(p => p.facilities?.includes('sports'))
    if (filters.dog) result = result.filter(p => p.facilities?.includes('dog'))

    result = result.filter(p => {
      const risk = (p.risk || '').toLowerCase()
      if (risk === 'low' && !filters.riskLow) return false
      if (risk === 'moderate' && !filters.riskModerate) return false
      if (risk === 'high' && !filters.riskHigh) return false
      return true
    })

    setFilteredParks(result)
  }, [parks, searchTerm, filters, viewMode, favoriteParkIds, myReviewedParkIds])

  const handleFilterChange = (newFilters) => setFilters(newFilters)
  const handleParkClick = (park) => setSelectedPark(park)
  const closeModal = () => setSelectedPark(null)

  const updatePark = (updatedPark) => {
    setParks(prev => prev.map(p => p.id === updatedPark.id ? updatedPark : p))
    setSelectedPark(updatedPark)
    if (!myReviewedParkIds.includes(updatedPark.id)) {
      setMyReviewedParkIds(prev => [...prev, updatedPark.id])
    }
  }

  const resetFilters = () => {
    setFilters({ charcoal: true, gasOnly: true, restroom: false, playground: false, sports: false, dog: false, riskLow: true, riskModerate: true, riskHigh: true })
    setSearchTerm('')
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 transition-colors duration-200">
      
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap md:flex-nowrap items-center justify-between gap-y-3 gap-x-4">
          
          <div className="flex items-center gap-x-2.5 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-lg sm:text-xl shadow-sm text-white">🔥</div>
            <div>
              <span className="font-bold text-xl sm:text-2xl tracking-tighter text-zinc-900 dark:text-white">SPARK</span>
              <span className="font-bold text-xl sm:text-2xl tracking-tighter text-emerald-600 dark:text-emerald-400">&amp; PARK</span>
            </div>
          </div>

          <div className="flex items-center gap-x-1.5 sm:gap-x-3 order-2 md:order-3 shrink-0">
            <button onClick={toggleDarkMode} className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 flex items-center justify-center gap-1.5 transition-all text-zinc-700 dark:text-zinc-200">
              <span className="text-sm">{isDarkMode ? '☀️' : '🌙'}</span>
              <span className="hidden sm:inline text-xs font-semibold">{isDarkMode ? 'Light' : 'Dark'}</span>
            </button>

            <select value={i18n.language?.substring(0,2) || 'en'} onChange={(e) => changeLanguage(e.target.value)} className="bg-zinc-100 dark:bg-zinc-800 text-xs sm:text-sm border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl px-1.5 py-1.5 sm:px-3 sm:py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium">
              <option value="en">EN</option><option value="ko">KO</option><option value="fr">FR</option><option value="zh">ZH</option><option value="pa">PA</option>
            </select>

            <div className="relative ml-0.5 sm:ml-0" onMouseEnter={() => window.innerWidth >= 768 && isLoggedIn && setIsDropdownOpen(true)} onMouseLeave={() => window.innerWidth >= 768 && isLoggedIn && setIsDropdownOpen(false)}>
              {!isLoggedIn ? (
                <button onClick={() => handleGoogleLogin()} className="flex items-center gap-x-1.5 sm:gap-x-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:border-emerald-600 px-3 sm:px-4 py-1.5 rounded-xl sm:rounded-3xl text-xs sm:text-sm cursor-pointer transition-all text-zinc-800 dark:text-zinc-200 font-semibold">
                  <i className="fa-brands fa-google text-red-500 text-[10px] sm:text-sm"></i>
                  <span className="hidden sm:inline">{t('nav.signIn', '로그인')}</span>
                  <span className="sm:hidden">{t('nav.signIn', '로그인')}</span>
                </button>
              ) : (
                <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-x-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:border-emerald-600 pl-1.5 pr-3 py-1 rounded-full sm:rounded-3xl text-sm cursor-pointer transition-all">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                    {userProfile?.picture ? <img src={userProfile.picture} alt="Profile" className="w-full h-full object-cover" /> : userProfile?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="text-left hidden sm:block"><div className="font-medium text-xs text-zinc-800 dark:text-zinc-200">{userProfile?.name || 'User'}</div></div>
                  <span className="sm:hidden text-xs font-bold text-zinc-500 dark:text-zinc-400">▼</span>
                </button>
              )}

              {isLoggedIn && isDropdownOpen && (
                <div className="absolute right-0 top-full pt-2 z-50 w-56 sm:w-60">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-2 flex flex-col">
                      <button onClick={() => { setViewMode('all'); setIsDropdownOpen(false) }} className={`text-left px-5 py-3 text-sm flex items-center gap-x-3 transition-colors ${viewMode === 'all' ? 'bg-emerald-50 dark:bg-emerald-900/30 font-semibold text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}><span className="text-lg">🌍</span> {t('nav.showAll', '모든 공원')}</button>
                      <button onClick={() => { setViewMode('favorites'); setIsDropdownOpen(false) }} className={`text-left px-5 py-3 text-sm flex items-center gap-x-3 transition-colors ${viewMode === 'favorites' ? 'bg-emerald-50 dark:bg-emerald-900/30 font-semibold text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}><span className="text-lg">❤️</span> {t('nav.favorites', '즐겨찾기')}</button>
                      <button onClick={() => { setViewMode('reviews'); setIsDropdownOpen(false) }} className={`text-left px-5 py-3 text-sm flex items-center gap-x-3 transition-colors ${viewMode === 'reviews' ? 'bg-emerald-50 dark:bg-emerald-900/30 font-semibold text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}><span className="text-lg">📝</span> {t('nav.myReviews', '나의 리뷰')}</button>
                      <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1.5 mx-2"></div>
                      <button onClick={handleLogout} className="w-full text-left px-5 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-x-3 font-medium"><i className="fa-solid fa-arrow-right-from-bracket text-lg w-5 text-center"></i> {t('nav.logout', '로그아웃')}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-full md:w-auto md:flex-1 md:max-w-md order-3 md:order-2">
            <div className="relative">
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t('nav.searchPlaceholder', '공원 이름 검색...')} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 focus:border-emerald-500 pl-10 pr-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-sm focus:outline-none text-zinc-900 dark:text-white placeholder-zinc-500" />
              <span className="absolute left-3.5 top-2.5 sm:top-3 text-zinc-400 text-sm">🔍</span>
            </div>
          </div>

        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-zinc-900 dark:text-white flex items-center gap-x-3">
              {viewMode === 'favorites' && '❤️ '}
              {viewMode === 'reviews' && '📝 '}
              {t('hero.title')}
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-zinc-600 dark:text-zinc-400 mt-1.5 sm:mt-2">
              {t('hero.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl flex items-center gap-x-1.5 shadow-sm">
              <span className="text-zinc-500 dark:text-zinc-400">{t('hero.wildfireRisk')}:</span>
              <span className={`font-semibold capitalize ${currentFireRisk.riskLevel === 'high' ? 'text-red-500' : currentFireRisk.riskLevel === 'moderate' ? 'text-yellow-600' : 'text-emerald-600'}`}>
                {currentFireRisk.rawDesc}
              </span>
            </div>
            <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl flex items-center gap-x-1.5 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-zinc-800 dark:text-zinc-200 font-medium">{t('hero.parksCount', { count: filteredParks.length })}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 pb-12">
          
          <div className="lg:col-span-3">
            {/* 🌟 모바일 필터 열기 버튼 (바텀 시트 팝업 호출) */}
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="w-full lg:hidden mb-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3.5 rounded-2xl flex justify-between items-center shadow-sm text-sm font-semibold text-zinc-800 dark:text-zinc-200 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-x-2.5">
                <span className="text-lg bg-zinc-100 dark:bg-zinc-800 w-8 h-8 flex items-center justify-center rounded-lg">🎛️</span>
                {t('filters.title', '필터 설정')}
              </div>
              <span className="text-zinc-400 text-xs bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">설정하기 ➔</span>
            </button>

            {/* 🌟 데스크톱 전용 필터 (PC 화면에서는 항상 표출됨) */}
            <div className="hidden lg:block">
              <Filters filters={filters} onChange={handleFilterChange} onReset={resetFilters} />
            </div>

            {/* 🌟 모바일 전용 바텀 시트 (Bottom Sheet) 모달 필터 */}
            {isMobileFilterOpen && (
              <div 
                className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex justify-center items-end lg:hidden transition-all"
                onClick={() => setIsMobileFilterOpen(false)}
              >
                <div 
                  className="bg-white dark:bg-zinc-950 w-full max-h-[85vh] overflow-y-auto rounded-t-3xl p-5 sm:p-6 animate-in slide-in-from-bottom-full duration-300 shadow-2xl flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 바텀 시트 헤더 */}
                  <div className="flex justify-between items-center mb-5 pb-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-x-2">
                      <span>🎛️</span> {t('filters.title', '필터 설정')}
                    </h3>
                    <button 
                      onClick={() => setIsMobileFilterOpen(false)}
                      className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-300 active:scale-90 transition-transform"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* 필터 본문 영역 */}
                  <div className="pb-4 flex-1">
                    <Filters filters={filters} onChange={handleFilterChange} onReset={resetFilters} />
                  </div>

                  {/* 🌟 고정된 필터 적용 버튼 (결과 개수 표시) */}
                  <div className="sticky bottom-0 pt-4 pb-2 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800/50 shrink-0">
                    <button 
                      onClick={() => setIsMobileFilterOpen(false)}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-emerald-900/20 text-sm sm:text-base flex items-center justify-center gap-x-2"
                    >
                      <span>적용하고 결과 보기</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{filteredParks.length}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl overflow-hidden h-[340px] sm:h-[480px] lg:h-[620px] shadow-sm relative z-10">
              <MapContainer center={[49.2827, -123.1207]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {userLocation.isRealGps && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng) && (
                  <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                    <Popup><div className="font-bold text-blue-600">{t('popup.youAreHere')}</div></Popup>
                  </Marker>
                )}
                {filteredParks.filter(park => park && Number.isFinite(park.lat) && Number.isFinite(park.lng)).map(park => {
                    let iconColor = '#ef4444'; let emoji = '🚫'
                    if (park.bbq === 'charcoal') { iconColor = '#22c55e'; emoji = '🔥' }
                    else if (park.bbq === 'gas-only') { iconColor = '#eab308'; emoji = '⛽' }
                    const customIcon = L.divIcon({
                      className: 'custom-marker',
                      html: `<div style="color: ${iconColor}; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${emoji}</div>`,
                      iconSize: [32, 32], iconAnchor: [16, 16]
                    })
                    return (
                      <Marker key={park.id} position={[park.lat, park.lng]} icon={customIcon} eventHandlers={{ click: () => handleParkClick(park) }}>
                        <Popup>
                          <div className="font-semibold text-zinc-900">{park.name}</div>
                          <div className="text-xs text-gray-500 my-1">{park.distance}</div>
                          <a href={getGoogleMapsDirectionsUrl(park.lat, park.lng, park.name)} target="_blank" rel="noreferrer" className="inline-block w-full text-center px-2 py-1 bg-emerald-600 text-white rounded mt-1 text-xs">{t('popup.getDirections')}</a>
                        </Popup>
                      </Marker>
                    )
                  })}
              </MapContainer>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 h-fit shadow-sm">
            <div className="flex justify-between items-end mb-4 px-1">
              <div>
                <div className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white">
                  {viewMode === 'favorites' ? t('nav.favorites') : viewMode === 'reviews' ? t('nav.myReviews') : t('list.title', '가까운 공원 목록')}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  {t('list.sortedBy', { count: filteredParks.length })}
                </div>
              </div>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-xs text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg">
                {t('list.top', '맨위로 ↑')}
              </button>
            </div>

            <div className="space-y-3 lg:max-h-[540px] lg:overflow-y-auto pr-1">
              {isParksLoading ? (
                <div className="text-center py-12 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-zinc-500">{t('list.loading')}</p>
                </div>
              ) : filteredParks.length > 0 ? (
                filteredParks.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).map(park => (
                  <ParkCard key={park.id} park={park} onClick={() => handleParkClick(park)} />
                ))
              ) : (
                <div className="text-center py-12 text-zinc-500 text-sm bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl">
                  {t('list.noParks', '조건에 맞는 공원이 없습니다.')}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {selectedPark && (
        <ParkModal park={selectedPark} onClose={closeModal} onUpdate={updatePark} userProfile={userProfile} isFavorite={favoriteParkIds.includes(selectedPark.id)} onToggleFavorite={() => toggleFavorite(selectedPark.id)} />
      )}

      <footer className="border-t border-zinc-200 dark:border-zinc-900 py-8 text-center text-xs sm:text-sm text-zinc-400">
        {t('footer.copyright')}
      </footer>
    </div>
  )
}

export default App