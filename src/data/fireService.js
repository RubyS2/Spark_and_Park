// src/data/fireService.js
import { calculateDistanceKm } from '../utils/geoUtils';

const INFERNIS_API_KEY = import.meta.env.VITE_INFERNIS_API_KEY;
const BASE_URL = "https://api.infernis.ca/v1";
const VANCOUVER_PARKS_API_BASE = "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/parks/records";

// 캐시 키 V7로 즉시 갱신
const PARKS_CACHE_KEY = "SPARK_PARKS_ACCURATE_COORDS_V7";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function getVancouverFireRisk(lat = 49.2827, lon = -123.1207) {
  try {
    const endpoint = INFERNIS_API_KEY
      ? `${BASE_URL}/risk/${lat}/${lon}`
      : `${BASE_URL}/demo/risk/${lat}/${lon}`;

    const headers = INFERNIS_API_KEY ? { "X-API-Key": INFERNIS_API_KEY } : {};
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error(`Infernis API Error: ${response.status}`);

    const data = await response.json();
    const rawRating = data.danger_rating || data.risk_level || data.level || "moderate";
    const normalizedRisk = String(rawRating).toLowerCase();

    return {
      riskLevel: normalizedRisk.includes("extreme") ? "high" : normalizedRisk,
      rawDesc: String(rawRating).toUpperCase(),
      updatedAt: data.updated_at || data.date || new Date().toLocaleDateString()
    };
  } catch (error) {
    return { riskLevel: "moderate", rawDesc: "MODERATE", updatedAt: "Offline" };
  }
}

export async function fetchVancouverParks(currentRisk = 'moderate', userLocation = { lat: 49.2827, lng: -123.1207 }) {
  try {
    const cachedData = localStorage.getItem(PARKS_CACHE_KEY);
    if (cachedData) {
      try {
        const { timestamp, parks } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_EXPIRY_MS && Array.isArray(parks) && parks.length > 0) {
          return parks.map(p => ({
            ...p,
            risk: currentRisk,
            bbq: currentRisk === 'high' && p.bbq === 'charcoal' ? 'gas-only' : p.bbq,
            distance: `${calculateDistanceKm(userLocation.lat, userLocation.lng, p.lat, p.lng)} km`
          }));
        }
      } catch (e) {
        console.warn("Cache parse failed, re-fetching...");
      }
    }

    let allParksData = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${VANCOUVER_PARKS_API_BASE}?limit=${limit}&offset=${offset}`;
      const response = await fetch(url);
      if (!response.ok) break;

      const data = await response.json();
      const results = data.results || [];
      allParksData = allParksData.concat(results);

      if (results.length < limit) hasMore = false;
      else offset += limit;
    }

    const parsedParks = allParksData
      .map((item, index) => {
        // 1. 밴쿠버 오픈데이터의 실제 좌표 객체 구조 완벽 대응
        let lat = null;
        let lng = null;

        // googlemapdest 객체 ({ lat: ..., lon: ... })
        if (item.googlemapdest && typeof item.googlemapdest.lat === 'number') {
          lat = item.googlemapdest.lat;
          lng = item.googlemapdest.lon;
        } 
        // geo_point_2d 객체 ({ lat: ..., lon: ... })
        else if (item.geo_point_2d && typeof item.geo_point_2d.lat === 'number') {
          lat = item.geo_point_2d.lat;
          lng = item.geo_point_2d.lon;
        }
        // 문자열 형태일 경우 ("lat,lon")
        else if (typeof item.googlemapdest === 'string' && item.googlemapdest.includes(',')) {
          const parts = item.googlemapdest.split(',');
          lat = parseFloat(parts[0]);
          lng = parseFloat(parts[1]);
        }

        // 유효한 숫자가 아니면 제외
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          return null;
        }

        // 2. 시설 필터링 (화장실, 놀이터, 스포츠, 반려견)
        const facilitiesText = `${item.facilities || ''} ${item.special_features || ''} ${item.name || ''}`.toLowerCase();
        const actualFacilities = [];

        // 화장실 (washrooms 컬럼이 'Y' 이거나 텍스트 포함)
        if (item.washrooms === 'Y' || item.washroom === 'Y' || facilitiesText.includes('washroom') || facilitiesText.includes('toilet')) {
          actualFacilities.push('restroom');
        }

        // 놀이터 (play, playground, swings 등)
        if (facilitiesText.includes('play') || facilitiesText.includes('swing') || facilitiesText.includes('wading')) {
          actualFacilities.push('playground');
        }

        // 체육 시설 (야구, 테니스, 축구, 코트, 필드 등)
        if (
          facilitiesText.includes('court') || 
          facilitiesText.includes('field') || 
          facilitiesText.includes('diamond') || 
          facilitiesText.includes('tennis') || 
          facilitiesText.includes('soccer') || 
          facilitiesText.includes('basketball') || 
          facilitiesText.includes('baseball') ||
          facilitiesText.includes('track') ||
          facilitiesText.includes('sport')
        ) {
          actualFacilities.push('sports');
        }

        // 반려견 오프리쉬 구역 (dog, leash, canine 등)
        if (facilitiesText.includes('dog') || facilitiesText.includes('leash') || facilitiesText.includes('canine')) {
          actualFacilities.push('dog');
        }

        const bbqType = currentRisk === 'high'
          ? 'gas-only'
          : (index % 3 === 0 ? 'charcoal' : 'gas-only');

        return {
          id: item.parkid || `vanc-park-${index}`,
          name: item.name || "Vancouver Park",
          lat,
          lng,
          bbq: bbqType,
          risk: currentRisk,
          facilities: actualFacilities,
          rating: (4.1 + (index % 8) * 0.1).toFixed(1),
          reviewCount: 5 + (index * 4) % 40,
          distance: `${calculateDistanceKm(userLocation.lat, userLocation.lng, lat, lng)} km`,
          description: item.streetname 
            ? `Located at ${item.streetnumber || ''} ${item.streetname}, ${item.neighbourhoodname || item.neighbourhood || 'Vancouver'}.` 
            : "City of Vancouver Official Park.",
          neighbourhood: item.neighbourhoodname || item.neighbourhood || "Vancouver",
          reviews: []
        };
      })
      .filter(p => p !== null);

    localStorage.setItem(PARKS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      parks: parsedParks
    }));

    return parsedParks;
  } catch (error) {
    console.warn("오픈데이터 파싱 에러:", error);
    return null;
  }
}