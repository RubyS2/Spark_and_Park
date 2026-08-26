import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ParkModal from './components/ParkModal'
import Filters from './components/Filters'
import ParkCard from './components/ParkCard'
import { initialParks } from './data/parks'
import { getVancouverFireRisk, fetchVancouverParks } from './data/fireService'
import { getGoogleMapsDirectionsUrl, calculateDistanceKm } from './utils/geoUtils'

// Fix default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// 내 위치 마커 아이콘
const userLocationIcon = L.divIcon({
  className: 'user-marker',
  html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #3b82f6;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
})

function App() {
  const [parks, setParks] = useState(initialParks)
  const [filteredParks, setFilteredParks] = useState(initialParks)
  const [selectedPark, setSelectedPark] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [userLocation, setUserLocation] = useState({ lat: 49.2827, lng: -123.1207, isRealGps: false, label: 'Downtown Vancouver' })
  const [currentFireRisk, setCurrentFireRisk] = useState({ riskLevel: 'moderate', rawDesc: 'Loading...', updatedAt: '' })
  
  const [filters, setFilters] = useState({
    charcoal: true,
    gasOnly: true,
    restroom: false,
    parking: false,
    picnic: false,
    water: false,
    riskLow: true,
    riskModerate: true,
    riskHigh: true,
  })

  // 1. 초기 데이터 로드 및 브라우저 GPS 수신
  useEffect(() => {
    async function init() {
      // 1) 산불 위험도 조회
      const fireData = await getVancouverFireRisk()
      setCurrentFireRisk(fireData)

      // 2) 브라우저 GPS 위치 요청
      let currentPos = { lat: 49.2827, lng: -123.1207, isRealGps: false, label: 'Downtown Vancouver' }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const gpsLat = pos.coords.latitude
            const gpsLng = pos.coords.longitude
            
            // 밴쿠버에서 100km 이상 떨어진 곳(예: 한국 등)인지 확인
            const distFromVanc = calculateDistanceKm(gpsLat, gpsLng, 49.2827, -123.1207)
            const isOutsideVancouver = distFromVanc > 100

            currentPos = {
              lat: gpsLat,
              lng: gpsLng,
              isRealGps: true,
              label: isOutsideVancouver ? `Real GPS (${distFromVanc.toLocaleString()}km away)` : 'Near Vancouver'
            }
            setUserLocation(currentPos)

            // 위치 기반으로 공원 데이터 거리 갱신
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

  // 2. 검색 및 필터링 로직
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
    if (filters.parking) result = result.filter(p => p.facilities?.includes('parking'))
    if (filters.picnic) result = result.filter(p => p.facilities?.includes('picnic'))
    if (filters.water) result = result.filter(p => p.facilities?.includes('water'))

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
      parking: false,
      picnic: false,
      water: false,
      riskLow: true,
      riskModerate: true,
      riskHigh: true
    })
    setSearchTerm('')
  }

  // 밴쿠버 시뮬레이션 위치로 전환하는 테스트 버튼용 함수
  const toggleVancouverDowntown = async () => {
    const downtownPos = { lat: 49.2827, lng: -123.1207, isRealGps: false, label: 'Downtown Vancouver' }
    setUserLocation(downtownPos)
    const apiParks = await fetchVancouverParks(currentFireRisk.riskLevel, downtownPos)
    if (apiParks) setParks(apiParks)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Navbar */}
      <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-x-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center">
              <span className="text-white text-3xl">🔥</span>
            </div>
            <div>
              <span className="font-bold text-3xl tracking-tighter">SPARK</span>
              <span className="font-bold text-3xl tracking-tighter text-emerald-400">&amp; PARK</span>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search parks or neighborhoods..."
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-600 pl-11 py-2.5 rounded-3xl text-sm focus:outline-none text-white"
              />
              <span className="absolute left-4 top-3 text-zinc-500">🔍</span>
            </div>
          </div>

          <div className="flex items-center gap-x-4">
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
                    facilities: ["restroom", "parking", "picnic"].slice(0, 2 + Math.floor(Math.random() * 2)),
                    description: "New park added by the community."
                  })
                }
              }}
              className="px-5 py-2 bg-white text-zinc-900 hover:bg-zinc-100 rounded-3xl text-sm font-semibold flex items-center gap-x-2 active:scale-95 transition-all"
            >
              + Add Park
            </button>

            {/* 현재 기준 위치 뱃지 (클릭 시 밴쿠버 다운타운 기준으로 리셋 가능) */}
            <button
              onClick={toggleVancouverDowntown}
              title="Click to reset location to Vancouver Downtown"
              className="flex items-center gap-x-2 bg-zinc-900 border border-zinc-800 hover:border-emerald-600 px-3 py-1.5 rounded-3xl text-sm cursor-pointer transition-all"
            >
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">JD</div>
              <div className="text-left">
                <div className="font-medium text-xs">Jisol Kim</div>
                <div className="text-[10px] text-emerald-400 -mt-0.5 max-w-[130px] truncate">
                  📍 {userLocation.label}
                </div>
              </div>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto px-6 pt-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-5xl font-semibold tracking-tighter">Find the perfect spot for BBQ</h1>
            <p className="text-xl text-zinc-400 mt-2">Real-time wildfire risk • Accurate rules • Local reviews</p>
          </div>
          <div className="flex items-center gap-x-3 text-sm">
            <div className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-3xl flex items-center gap-x-2">
              <span className="text-xs text-zinc-400">Wildfire Risk:</span>
              <span className={`font-semibold capitalize ${
                currentFireRisk.riskLevel === 'high' ? 'text-red-400' :
                currentFireRisk.riskLevel === 'moderate' ? 'text-yellow-400' : 'text-emerald-400'
              }`}>
                {currentFireRisk.rawDesc}
              </span>
            </div>

            <div className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-3xl flex items-center gap-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span>{filteredParks.length} parks online</span>
            </div>
            <div className="px-3 py-2 bg-emerald-900/40 text-emerald-300 border border-emerald-800 rounded-3xl text-xs flex items-center gap-x-1.5">
              BCWS Live Sync
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Filters */}
          <div className="lg:col-span-3">
            <Filters 
              filters={filters} 
              onChange={handleFilterChange} 
              onReset={resetFilters} 
            />
          </div>

          {/* Map */}
          <div className="lg:col-span-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden" style={{ height: '620px' }}>
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

                {/* 내 GPS 위치 마커 */}
                {userLocation.isRealGps && (
                  <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                    <Popup>
                      <div className="font-bold text-blue-600">📍 You are here</div>
                    </Popup>
                  </Marker>
                )}
                
                {filteredParks.map(park => {
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
                          {park.distance} • {park.bbq === 'charcoal' ? 'Charcoal + Gas' : park.bbq === 'gas-only' ? 'Gas only' : 'No BBQ'}
                        </div>
                        <div className="text-[10px] mb-2 font-bold text-zinc-600">
                          Risk: <span className="uppercase">{park.risk}</span>
                        </div>
                        <a
                          href={getGoogleMapsDirectionsUrl(park.lat, park.lng, park.name)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block w-full text-center px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                        >
                          🗺️ Get Directions
                        </a>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
            <div className="flex justify-between items-center mt-2 px-1 text-xs text-zinc-500">
              <div className="flex gap-x-4">
                <div className="flex items-center gap-x-1.5"><span className="text-emerald-500">🔥</span> Charcoal allowed</div>
                <div className="flex items-center gap-x-1.5"><span className="text-yellow-400">⛽</span> Gas only</div>
                <div className="flex items-center gap-x-1.5"><span className="text-red-500">🚫</span> Prohibited</div>
              </div>
              <div>Live API: Vancouver Open Data + BCWS</div>
            </div>
          </div>

          {/* Nearby List */}
          <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 h-fit">
            <div className="flex justify-between items-center mb-4 px-1">
              <div>
                <div className="font-semibold">Nearby Parks</div>
                <div className="text-xs text-emerald-400">
                  Sorted by distance • {filteredParks.length} results
                </div>
              </div>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-xs text-emerald-400 hover:text-emerald-300">MAP ↑</button>
            </div>

            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
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
                <div className="text-center py-12 text-zinc-500">
                  No parks match your filters.<br />Try broadening your search.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Park Detail Modal */}
      {selectedPark && (
        <ParkModal 
          park={selectedPark} 
          onClose={closeModal} 
          onUpdate={updatePark} 
        />
      )}

      <footer className="mt-16 border-t border-zinc-900 py-8 text-center text-zinc-500">
        Spark &amp; Park — 2026 Graduation Project • Built with React + Firebase by Jisol Kim • 
        For educational purposes in Vancouver, BC
      </footer>
    </div>
  )
}

export default App