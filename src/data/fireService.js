// src/data/fireService.js
import { calculateDistanceKm } from '../utils/geoUtils';

const INFERNIS_API_KEY = import.meta.env.VITE_INFERNIS_API_KEY;
const BASE_URL = "https://api.infernis.ca/v1";
const VANCOUVER_PARKS_API_BASE = "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/parks/records";

// 캐시 키 버전을 V4로 올려 이전 캐시를 완전히 무력화
const PARKS_CACHE_KEY = "SPARK_PARKS_ACCURATE_FACILITIES_V4";
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

    const parsedParks = allParksData.map((item, index) => {
      const lat = Number(item.geo_point_2d?.lat || (item.googlemapdest ? parseFloat(String(item.googlemapdest).split(',')[0]) : (49.25 + (index % 10) * 0.01)));
      const lng = Number(item.geo_point_2d?.lon || (item.googlemapdest ? parseFloat(String(item.googlemapdest).split(',')[1]) : (-123.12 + (index % 10) * 0.01)));

      // 밴쿠버 오픈데이터 텍스트 필드 전부 통합 (소문자화)
      const facilitiesText = `${item.facilities || ''} ${item.special_features || ''} ${item.name || ''}`.toLowerCase();
      const actualFacilities = [];

      // 1. 화장실 (washrooms 컬럼이 'Y' 이거나 텍스트 포함)
      if (item.washrooms === 'Y' || item.washroom === 'Y' || facilitiesText.includes('washroom') || facilitiesText.includes('toilet')) {
        actualFacilities.push('restroom');
      }

      // 2. 어린이 놀이터 (play, playground, swings 등)
      if (
        facilitiesText.includes('play') || 
        facilitiesText.includes('playground') || 
        facilitiesText.includes('swing') ||
        facilitiesText.includes('wading')
      ) {
        actualFacilities.push('playground');
      }

      // 3. 체육 시설 (야구 다이아몬드, 테니스, 축구, 필드, 코트, 트랙, 럭비 등)
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

      // 4. 반려견 오프리쉬 구역 (dog, off-leash, canine 등)
      if (
        facilitiesText.includes('dog') || 
        facilitiesText.includes('off-leash') || 
        facilitiesText.includes('off leash') ||
        facilitiesText.includes('canine')
      ) {
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
    });

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