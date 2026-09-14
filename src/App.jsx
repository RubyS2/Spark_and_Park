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
// 구글 로그인 훅 추가
import { useGoogleLogin } from '@react-oauth/google'

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

function App() {
  const { t, i18n } = useTranslation()
  const [parks, setParks] = useState(initialParks)
  const [filteredParks, setFilteredParks] = useState(initialParks)
  const [selectedPark, setSelectedPark] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [userLocation, setUserLocation] = useState({ lat: 49.2827, lng: -123.1207, isRealGps: false, label: 'Downtown Vancouver' })
  const [currentFireRisk, setCurrentFireRisk] = useState({ riskLevel: 'moderate', rawDesc: 'Loading...', updatedAt: '' })

  // 🌟 로그인 및 사용자 프로필 상태 관리
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [userProfile, setUserProfile] = useState(null)

  // 🌟 구글 로그인 팝업 호출 및 토큰으로 유저 정보(이름, 프사) 가져오기
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const data = await res.json()
        setUserProfile(data) // 가져온 구글 계정 정보 저장
        setIsLoggedIn(true)
      } catch (err) {
        console.error("Failed to fetch user info", err)
      }
    },
    onError: (error) => console.error('Login Failed:', error)
  })

  // 🌟 로그아웃 처리
  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserProfile(null)
    setIsDropdownOpen(false)
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

            const apiParks = await fetchVancouverParks(fireData.riskLevel, currentPos)
            if (apiParks) setParks(apiParks)
          },
          async (err) => {
            console.warn("GPS 거부 또는 대기 -> 기본 밴쿠버 다운타운 좌표 적용", err)
            const apiParks = await fetchVancouverParks(fireData.riskLevel, currentPos)
            if (apiParks) setParks(apiParks)
          },
          { enableHighAccuracy: true, timeout: 8000 }
        )
      } else {
        const apiParks = await fetchVancouverParks(fireData.riskLevel, currentPos)
        if (apiParks) setParks(apiParks)
      }
    }

    init()
  }, [])

  useEffect(() => {
    let result = parks

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
  }, [parks, searchTerm, filters])

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
      rating: 4.0,
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
    if (apiParks) setParks(apiParks)
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
                const name = prompt("Enter new park name:")
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

            {/* 🌟 로그인/프로필 드롭다운 영역 */}
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
                  Sign in
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
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="py-2">
                    <button 
                      onClick={() => alert("즐겨찾기한 공원 목록을 보여주는 페이지입니다.")}
                      className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-x-3"
                    >
                      <span>🔖</span> Favorites
                    </button>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1"></div>
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-x-3 font-medium"
                    >
                      <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </nav>

      {/* Main Content */}
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
                      <div className="font-bold text-blue-600">📍 You are here</div>
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
              {filteredParks.length > 0 ? (
                filteredParks
                  .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
                  .slice(0, 15)
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

      {selectedPark && (
        <ParkModal 
          park={selectedPark} 
          onClose={closeModal} 
          onUpdate={updatePark} 
        />
      )}

      <footer className="mt-12 sm:mt-16 border-t border-zinc-200 dark:border-zinc-900 py-6 sm:py-8 text-center text-xs sm:text-sm text-zinc-500 px-4">
        Spark &amp; Park — 2026 Graduation Project • Built with React + Firebase by Jisol Kim • 
        For educational purposes in Vancouver, BC
      </footer>
    </div>
  )
}

export default App