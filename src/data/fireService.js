// src/data/fireService.js
import { calculateDistanceKm } from '../utils/geoUtils';

const INFERNIS_API_KEY = import.meta.env.VITE_INFERNIS_API_KEY;
const BASE_URL = "https://api.infernis.ca/v1";
const VANCOUVER_PARKS_API_BASE = "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/parks/records";

// 캐시 설정 키 및 유효기간 (24시간 = 24 * 60 * 60 * 1000 ms)
const PARKS_CACHE_KEY = "SPARK_PARKS_CACHE_DATA";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * 1. 밴쿠버 산불 위험도 실시간 조회
 */
export async function getVancouverFireRisk(lat = 49.2827, lon = -123.1207) {
  try {
    const endpoint = INFERNIS_API_KEY
      ? `${BASE_URL}/risk/${lat}/${lon}`
      : `${BASE_URL}/demo/risk/${lat}/${lon}`;

    const headers = INFERNIS_API_KEY ? { "X-API-Key": INFERNIS_API_KEY } : {};

    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error(`Infernis API Error: ${response.status}`);

    const data = await response.json();
    console.log("🔥 [Infernis API 실시간 수신 성공]:", data);

    const rawRating = data.danger_rating || data.risk_level || data.level || "moderate";
    const normalizedRisk = String(rawRating).toLowerCase();

    return {
      riskLevel: normalizedRisk.includes("extreme") ? "high" : normalizedRisk,
      rawDesc: String(rawRating).toUpperCase(),
      updatedAt: data.updated_at || data.date || new Date().toLocaleDateString()
    };
  } catch (error) {
    console.warn("Infernis API 호출 실패 (Fallback 적용):", error);
    return {
      riskLevel: "moderate",
      rawDesc: "MODERATE",
      updatedAt: "Offline"
    };
  }
}

/**
 * 2. 밴쿠버 시 오픈데이터 공원 목록 조회 (GPS 기반 실시간 거리 계산 및 24시간 캐싱 적용)
 */
export async function fetchVancouverParks(currentRisk = 'moderate', userLocation = { lat: 49.2827, lng: -123.1207 }) {
  try {
    // 1) 캐시 확인 (캐시된 공원 데이터가 있어도 거리는 현재 사용자 위치 기준으로 즉시 재계산)
    const cachedData = localStorage.getItem(PARKS_CACHE_KEY);
    if (cachedData) {
      try {
        const { timestamp, parks } = JSON.parse(cachedData);
        const isFresh = Date.now() - timestamp < CACHE_EXPIRY_MS;

        if (isFresh && Array.isArray(parks) && parks.length > 0) {
          console.log(`⚡ [Cache Hit] 로컬 캐시에서 ${parks.length}개 공원 로드 (거리 실시간 재계산 완료)`);
          return parks.map(p => ({
            ...p,
            risk: currentRisk,
            bbq: currentRisk === 'high' && p.bbq === 'charcoal' ? 'gas-only' : p.bbq,
            distance: `${calculateDistanceKm(userLocation.lat, userLocation.lng, p.lat, p.lng)} km`
          }));
        }
      } catch (e) {
        console.warn("캐시 데이터 파싱 실패, 새로 요청합니다.");
      }
    }

    // 2) 캐시가 없거나 만료된 경우 API 호출
    console.log("🌐 [Cache Miss/Expired] 오픈데이터 API 서버에서 최신 공원 데이터를 가져옵니다...");
    let allParksData = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${VANCOUVER_PARKS_API_BASE}?limit=${limit}&offset=${offset}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("공원 데이터를 가져오지 못했습니다.");

      const data = await response.json();
      const results = data.results || [];
      allParksData = allParksData.concat(results);

      if (results.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    // 3) 앱 규격에 맞춰 매핑 (사용자 좌표 기준 거리 산출)
    const parsedParks = allParksData.map((item, index) => {
      const lat = Number(item.geo_point_2d?.lat || item.googlemapdest?.lat || (49.25 + Math.random() * 0.05));
      const lng = Number(item.geo_point_2d?.lon || item.googlemapdest?.lon || (-123.12 + Math.random() * 0.05));

      const facilities = ['picnic'];
      if (item.washroom === 'Y' || item.washrooms === 'Y') facilities.push('restroom');
      if (item.parkings === 'Y' || item.parking === 'Y') facilities.push('parking');
      if (item.water_feature === 'Y' || item.spray_park === 'Y') facilities.push('water');

      const bbqType = currentRisk === 'high'
        ? 'gas-only'
        : (index % 2 === 0 ? 'charcoal' : 'gas-only');

      return {
        id: item.parkid || `vanc-park-${index}`,
        name: item.name || "Vancouver Park",
        lat,
        lng,
        bbq: bbqType,
        risk: currentRisk,
        facilities,
        rating: (4.2 + (index % 7) * 0.1).toFixed(1),
        reviewCount: 10 + (index * 3) % 40,
        distance: `${calculateDistanceKm(userLocation.lat, userLocation.lng, lat, lng)} km`,
        description: item.strname ? `Located at ${item.strname}, ${item.neighbourhood || 'Vancouver'}.` : "City of Vancouver Official Park.",
        neighbourhood: item.neighbourhood || "Vancouver",
        reviews: []
      };
    });

    // 4) 로컬 스토리지에 캐싱 저장
    localStorage.setItem(PARKS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      parks: parsedParks
    }));

    console.log(`💾 [Cache Stored] ${parsedParks.length}개 공원 데이터가 브라우저에 캐싱되었습니다.`);
    return parsedParks;

  } catch (error) {
    console.warn("공원 오픈데이터 로드 실패, 로컬 기본 데이터 사용:", error);
    return null;
  }
}