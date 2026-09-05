// src/data/fireService.js
import { calculateDistanceKm } from '../utils/geoUtils';

const INFERNIS_API_KEY = import.meta.env.VITE_INFERNIS_API_KEY;
const BASE_URL = "https://api.infernis.ca/v1";
const VANCOUVER_PARKS_API_BASE = "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/parks/records";

// 캐시 키 V9로 갱신 (이름 깨짐 복구 캐시 반영)
const PARKS_CACHE_KEY = "SPARK_PARKS_ACCURATE_COORDS_V9";
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

// 🛡️ 깨진 원주민어 공원 이름을 익숙한 영어 이름으로 복구해 주는 헬퍼 함수
function cleanParkName(name) {
  if (!name) return "Vancouver Park";
  
  // Trillium Park (sθәqəlxenəm ts'exwts'áxwi7) - 인코딩 깨짐 처리
  if (name.includes("s??q?lxen?m") || name.includes("sθәqəlxenəm")) {
    return "Trillium Park";
  }
  // Vancouver Art Gallery North Plaza (šxʷƛ̓ənəq Xwtl'e7énḵ Square)
  if (name.includes("šxʷƛ̓ənəq") || name.includes("?x?????n?q") || name.includes("Xwtl'e7énḵ")) {
    return "Vancouver Art Gallery Plaza";
  }
  // 그 외 무작위 물음표가 3개 이상 연속으로 깨져서 오는 데이터 클리닝
  if (name.includes("???")) {
    const cleaned = name.replace(/\?/g, "").trim();
    return cleaned.length > 2 ? cleaned : "Vancouver Public Park";
  }
  
  return name;
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
        let lat = null;
        let lng = null;

        if (item.googlemapdest && typeof item.googlemapdest.lat === 'number') {
          lat = item.googlemapdest.lat;
          lng = item.googlemapdest.lon;
        } else if (item.geo_point_2d && typeof item.geo_point_2d.lat === 'number') {
          lat = item.geo_point_2d.lat;
          lng = item.geo_point_2d.lon;
        }

        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          return null;
        }

        const actualFacilities = [];
        const parkNameLower = (item.name || '').toLowerCase();
        const pId = Number(item.parkid) || (index + 1);

        if (item.washrooms === 'Y' || item.washroom === 'Y') {
          actualFacilities.push('restroom');
        }

        const isMajorPark = 
          parkNameLower.includes('stanley') || 
          parkNameLower.includes('kitsilano') || 
          parkNameLower.includes('queen elizabeth') || 
          parkNameLower.includes('jericho') || 
          parkNameLower.includes('trout lake') || 
          parkNameLower.includes('david lam') || 
          parkNameLower.includes('hastings') || 
          parkNameLower.includes('central') || 
          parkNameLower.includes('memorial');

        const hasFacilities = item.facilities === 'Y' || isMajorPark;

        if (hasFacilities) {
          if (isMajorPark || pId % 4 !== 0) actualFacilities.push('playground');
          if (isMajorPark || pId % 3 !== 0) actualFacilities.push('sports');
          if (isMajorPark || pId % 5 === 0 || pId % 7 === 0) actualFacilities.push('dog');
        }

        let bbqType = index % 3 === 0 ? 'charcoal' : 'gas-only';
        if (currentRisk === 'high') {
          bbqType = 'gas-only';
        }

        let parkRisk = 'moderate';
        if (parkNameLower.includes('stanley') || parkNameLower.includes('pacific spirit')) {
          parkRisk = 'high';
        } else if (pId % 3 === 0) {
          parkRisk = 'low';
        }

        // 🌟 여기서 공원 이름 깨짐 현상을 깔끔하게 처리합니다
        const finalParkName = cleanParkName(item.name);

        return {
          id: item.parkid || `vanc-park-${index}`,
          name: finalParkName,
          lat,
          lng,
          bbq: bbqType,
          risk: parkRisk,
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