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

// 🌟 Firebase 연동을 위한 도구 추가 (doc, getDoc, setDoc 추가)
import { db } from './firebase'
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'

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
    console.error("리뷰 데이터 병합 에러:", error)
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
    return !!localStorage.getItem('sparkUser') // 정보가 있으면 true, 없으면 false
  })
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  // 🌟 즐겨찾기 상태 추가
  const [favoriteParkIds, setFavoriteParkIds] = useState([])
  const [showFavorites, setShowFavorites] = useState(false) // 즐겨찾기 뷰 토글

  // 🌟 로그인이 완료되거나 프로필이 변경될 때 Firebase에서 내 즐겨찾기 목록 가져오기
  useEffect(() => {
    const fetchFavorites = async () => {
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
          console.error("즐겨찾기 불러오기 에러:", error)
        }
      } else {
        setFavoriteParkIds([])
        setShowFavorites(false)
      }
    }
    fetchFavorites()
  }, [userProfile])

  // 🌟 공원을 즐겨찾기에 추가/제거하는 함수 (나중에 ParkModal로 전달)
  const toggleFavorite = async (parkId) => {
    if (!userProfile) {
      alert(t('modal.loginRequired'))
      return
    }
    
    // 이미 있으면 빼고, 없으면 넣기
    const isFav = favoriteParkIds.includes(parkId)
    const newFavs = isFav 
      ? favoriteParkIds.filter(id => id !== parkId) 
      : [...favoriteParkIds, parkId]
    
    setFavoriteParkIds(newFavs) // 화면 즉시 업데이트

    try {
      // Firebase 'userFavorites' 폴더의 '내 고유 ID' 문서에 배열 저장
      await setDoc(doc(db, 'userFavorites', userProfile.sub), {
        parks: newFavs
      })
    } catch (error) {
      console.error("즐겨찾기 저장 에러:", error)
      alert("즐겨찾기 업데이트 중 오류가 발생했습니다.")
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
    setShowFavorites(false)
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

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
  }

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
            const isOutsideVancouver = distFromVanc > 100

            currentPos = {
              lat: gpsLat,
              lng: gpsLng,
              isRealGps: true,
              label: isOutsideVancouver ? `Real GPS (${distFromVanc.toLocaleString()}km)` : 'Near Vancouver'
            }
            setUserLocation(currentPos)
            await loadParksWithReviews(fireData.riskLevel, currentPos)
          },
          async (err) => {
            console.warn("GPS 거부 또는 대기 -> 기본 밴쿠버 다운타운 좌표 적용", err)
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

    // 🌟 즐겨찾기 필터 적용
    if (showFavorites) {
      result = result.filter(p => favoriteParkIds.includes(p.id))
    }

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
  }, [parks, searchTerm, filters, showFavorites, favoriteParkIds])

  const handleFilterChange = (newFilters) => setFilters(newFilters)
  const handleParkClick = (park) => setSelectedPark(park)
  const closeModal = () => setSelectedPark(null)

  const updatePark = (updatedPark) => {
    setParks(prev => prev.map(p => p.id === updatedPark.id ? updatedPark : p))
    setSelectedPark(updatedPark)
  }

  const addNewPark = (newParkData) => {
    const newPark = {
      ...newParkData,
      id: Date.now(),
      rating: 0.0,
      reviewCount: 0,
      reviews: [],
      distance: "0.1 km"
    }
    setParks(prev => [newPark, ...prev])
    setSelectedPark(newPark)
  }

  const resetFilters = () => {
    setFilters({
      charcoal: true,
      gasOnly: true,
      restroom: false,
      playground: false,
      sports: false,
      dog: false,
      riskLow: true,
      riskModerate: true,
      riskHigh: true
    })
    setSearchTerm('')
  }

  const toggleVancouverDowntown = async () => {
    const downtownPos = { lat: 49.2827, lng: -123.1207, isRealGps: false, label: 'Downtown Vancouver' }
    setUserLocation(downtownPos)
    const apiParks = await fetchVancouverParks(currentFireRisk.riskLevel, downtownPos)
    if (apiParks) {
      const mergedParks = await fetchAndMergeReviews(apiParks)
      setParks(mergedParks)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 transition-colors duration-200">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 md:h-16 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-x-2.5">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-xl shadow-sm text-white">
                🔥
              </div>
              <div>
                <span className="font-bold text-2xl tracking-tighter text-zinc-900 dark:text-white">SPARK</span>
                <span className="font-bold text-2xl tracking-tighter text-emerald-600 dark:text-emerald-400">&amp; PARK</span>
              </div>
            </div>

            <div className="flex items-center gap-x-2 md:hidden">
              <button
                onClick={toggleDarkMode}
                aria-label="Toggle Theme"
                className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm flex items-center justify-center transition-all"
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <select
                value={i18n.language?.startsWith('ko') ? 'ko' : i18n.language?.startsWith('fr') ? 'fr' : i18n.language?.startsWith('zh') ? 'zh' : i18n.language?.startsWith('pa') ? 'pa' : 'en'}
                onChange={(e) => changeLanguage(e.target.value)}
                aria-label="Select Language"
                className="bg-zinc-100 dark:bg-zinc-800 text-xs border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl px-2 py-1.5 focus:outline-none"
              >
                <option value="en">EN</option>
                <option value="ko">KO</option>
                <option value="fr">FR</option>
                <option value="zh">中文</option>
                <option value="pa">ਪੰਜਾਬੀ</option>
              </select>
            </div>
          </div>

          <div className="w-full md:flex-1 md:max-w-md md:mx-6">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('nav.searchPlaceholder')}
                className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-600 pl-10 pr-4 py-2 rounded-2xl text-sm focus:outline-none text-zinc-900 dark:text-white placeholder-zinc-500"
              />
              <span className="absolute left-3.5 top-2.5 text-zinc-400 text-sm">🔍</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-x-3">
            <button
              onClick={toggleDarkMode}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="px-3 py-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 text-xs font-semibold flex items-center gap-1.5 transition-all text-zinc-700 dark:text-zinc-200"
            >
              <span>{isDarkMode ? '☀️ Light' : '🌙 Dark'}</span>
            </button>

            <select
              value={i18n.language?.startsWith('ko') ? 'ko' : i18n.language?.startsWith('fr') ? 'fr' : i18n.language?.startsWith('zh') ? 'zh' : i18n.language?.startsWith('pa') ? 'pa' : 'en'}
              onChange={(e) => changeLanguage(e.target.value)}
              aria-label="Select Language"
              className="bg-zinc-100 dark:bg-zinc-800 text-xs border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-2xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="en">🌐 English (EN)</option>
              <option value="ko">🌐 한국어 (KO)</option>
              <option value="fr">🌐 Français (FR)</option>
              <option value="zh">🌐 繁體中文 (ZH)</option>
              <option value="pa">🌐 ਪੰਜਾਬੀ (PA)</option>
            </select>

            <button 
              onClick={() => {
                const name = prompt(t('nav.addParkPrompt'))
                if (name) {
                  addNewPark({
                    name,
                    lat: 49.27 + (Math.random() - 0.5) * 0.08,
                    lng: -123.12 + (Math.random() - 0.5) * 0.12,
                    bbq: Math.random() > 0.5 ? "charcoal" : "gas-only",
                    risk: currentFireRisk.riskLevel,
                    facilities: ["restroom", "playground", "sports"].slice(0, 2 + Math.floor(Math.random() * 2)),
                    description: "New park added by the community."
                  })
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl text-sm font-semibold flex items-center gap-x-2 active:scale-95 transition-all shadow-sm"
            >
              {t('nav.addPark')}
            </button>

            <div 
              className="relative"
              onMouseEnter={() => isLoggedIn && setIsDropdownOpen(true)}
              onMouseLeave={() => isLoggedIn && setIsDropdownOpen(false)}
            >
              {!isLoggedIn ? (
                <button
                  onClick={() => handleGoogleLogin()}
                  className="flex items-center gap-x-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:border-emerald-600 px-4 py-1.5 rounded-3xl text-sm cursor-pointer transition-all text-zinc-800 dark:text-zinc-200 font-semibold"
                >
                  <i className="fa-brands fa-google text-red-500"></i>
                  {t('nav.signIn')}
                </button>
              ) : (
                <button
                  onClick={toggleVancouverDowntown}
                  title="Click to reset location to Vancouver Downtown"
                  className="flex items-center gap-x-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:border-emerald-600 px-3 py-1.5 rounded-3xl text-sm cursor-pointer transition-all"
                >
                  <div className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold overflow-hidden">
                    {userProfile?.picture ? (
                      <img src={userProfile.picture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      userProfile?.name?.charAt(0) || 'U'
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-xs text-zinc-800 dark:text-zinc-200">
                      {userProfile?.name || 'User'}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 -mt-0.5 max-w-[120px] truncate">
                      📍 {userLocation.label}
                    </div>
                  </div>
                </button>
              )}

              {isLoggedIn && isDropdownOpen && (
                <div className="absolute right-0 top-full pt-2 z-50">
                  <div className="w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-2">
                      {/* 🌟 드롭다운을 알림창 대신 진짜 필터 스위치로 변경 */}
                      <button 
                        onClick={() => {
                          setShowFavorites(!showFavorites)
                          setIsDropdownOpen(false)
                        }}
                        className="w-full text-left px-5 py-3 text-sm sm:text-base text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-x-3"
                      >
                        {showFavorites ? (
                          <><span className="text-lg">🌍</span> {t('nav.showAll')}</>
                        ) : (
                          <><span className="text-lg">❤️</span> {t('nav.favorites')}</>
                        )}
                      </button>
                      
                      <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1.5"></div>
                      
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left px-5 py-3 text-sm sm:text-base text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-x-3 font-medium"
                      >
                        <i className="fa-solid fa-arrow-right-from-bracket text-lg w-5 text-center"></i> {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              {t('hero.title')}
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-zinc-600 dark:text-zinc-400 mt-1 sm:mt-2">
              {t('hero.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-x-1.5 shadow-sm">
              <span className="text-zinc-500 dark:text-zinc-400">{t('hero.wildfireRisk')}:</span>
              <span className={`font-semibold capitalize ${
                currentFireRisk.riskLevel === 'high' ? 'text-red-500 dark:text-red-400' :
                currentFireRisk.riskLevel === 'moderate' ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {currentFireRisk.rawDesc}
              </span>
            </div>

            <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-x-1.5 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-zinc-800 dark:text-zinc-200">{t('hero.parksCount', { count: filteredParks.length })}</span>
            </div>

            <div className="px-3 py-1.5 sm:px-3 sm:py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs font-medium">
              {t('hero.liveSync')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-3">
            <Filters 
              filters={filters} 
              onChange={handleFilterChange} 
              onReset={resetFilters} 
            />
          </div>

          <div className="lg:col-span-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl overflow-hidden h-[360px] sm:h-[480px] lg:h-[620px] shadow-sm">
              <MapContainer 
                center={[49.2827, -123.1207]} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {userLocation.isRealGps && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng) && (
                  <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                    <Popup>
                      <div className="font-bold text-blue-600">{t('popup.youAreHere')}</div>
                    </Popup>
                  </Marker>
                )}
                
                {filteredParks
                  .filter(park => park && Number.isFinite(park.lat) && Number.isFinite(park.lng))
                  .map(park => {
                    let iconColor = '#ef4444'
                    let emoji = '🚫'
                    if (park.bbq === 'charcoal') { iconColor = '#22c55e'; emoji = '🔥' }
                    else if (park.bbq === 'gas-only') { iconColor = '#eab308'; emoji = '⛽' }

                    const customIcon = L.divIcon({
                      className: 'custom-marker',
                      html: `<div style="color: ${iconColor}; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${emoji}</div>`,
                      iconSize: [32, 32],
                      iconAnchor: [16, 16]
                    })

                    return (
                      <Marker 
                        key={park.id} 
                        position={[park.lat, park.lng]} 
                        icon={customIcon}
                        eventHandlers={{
                          click: () => handleParkClick(park)
                        }}
                      >
                        <Popup>
                          <div className="font-semibold text-zinc-900">{park.name}</div>
                          <div className="text-xs text-gray-500 my-1">
                            {park.distance} • {park.bbq === 'charcoal' ? t('popup.charcoalGas') : park.bbq === 'gas-only' ? t('popup.gasOnly') : t('popup.noBbq')}
                          </div>
                          <div className="text-[10px] mb-2 font-bold text-zinc-600">
                            {t('popup.risk')}: <span className="uppercase">{park.risk}</span>
                          </div>
                          <a
                            href={getGoogleMapsDirectionsUrl(park.lat, park.lng, park.name)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block w-full text-center px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                          >
                            {t('popup.getDirections')}
                          </a>
                        </Popup>
                      </Marker>
                    )
                  })}
              </MapContainer>
            </div>
            
            <div className="flex flex-wrap justify-between items-center mt-2 px-1 text-[11px] sm:text-xs text-zinc-500 gap-y-1">
              <div className="flex gap-x-3 sm:gap-x-4">
                <div className="flex items-center gap-x-1"><span className="text-emerald-500">🔥</span> {t('card.charcoal')}</div>
                <div className="flex items-center gap-x-1"><span className="text-yellow-500">⛽</span> {t('card.gasOnly')}</div>
                <div className="flex items-center gap-x-1"><span className="text-red-500">🚫</span> {t('card.noBbq')}</div>
              </div>
              <div>Vancouver Open Data + BCWS</div>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 h-fit shadow-sm">
            <div className="flex justify-between items-center mb-3 sm:mb-4 px-1">
              <div>
                <div className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-white">{t('list.title')}</div>
                <div className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {t('list.sortedBy', { count: filteredParks.length })}
                </div>
              </div>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {t('list.top')}
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] sm:max-h-[540px] overflow-y-auto pr-1">
              {isParksLoading ? (
                <div className="text-center py-12 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{t('list.loading')}</p>
                </div>
              ) : filteredParks.length > 0 ? (
                filteredParks
                  .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
                  .map(park => (
                    <ParkCard 
                      key={park.id} 
                      park={park} 
                      onClick={() => handleParkClick(park)} 
                    />
                  ))
              ) : (
                <div className="text-center py-10 text-zinc-500 text-xs sm:text-sm whitespace-pre-line">
                  {t('list.noParks')}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 🌟 ParkModal로 상태와 함수 넘기기 */}
      {selectedPark && (
        <ParkModal 
          park={selectedPark} 
          onClose={closeModal} 
          onUpdate={updatePark}
          userProfile={userProfile} 
          isFavorite={favoriteParkIds.includes(selectedPark.id)}
          onToggleFavorite={() => toggleFavorite(selectedPark.id)}
        />
      )}

      <footer className="mt-12 sm:mt-16 border-t border-zinc-200 dark:border-zinc-900 py-6 sm:py-8 text-center text-xs sm:text-sm text-zinc-500 px-4">
        {t('footer.copyright')}
      </footer>
    </div>
  )
}

export default App