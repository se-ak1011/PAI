// Find nearby trade/DIY shops using OpenStreetMap's Overpass API.
// Free, no API key, no account. Good enough for "is there a Screwfix near me?".

export interface NearbyShop {
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  brand?: string;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Haversine distance in km.
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find trade/DIY/hardware shops within `radiusM` metres of a coordinate.
 * Matches common UK brands by name plus generic hardware/building shops.
 */
export async function findNearbyShops(
  lat: number,
  lon: number,
  radiusM = 16000,
): Promise<{ shops: NearbyShop[]; error: string | null }> {
  const brands = 'Screwfix|Toolstation|B&Q|Wickes|Travis Perkins|Jewson|B&M|Selco|Howdens';
  const query = `
    [out:json][timeout:25];
    (
      node["shop"~"hardware|doityourself|trade|building_materials|paint|electrical"](around:${radiusM},${lat},${lon});
      node["name"~"${brands}",i](around:${radiusM},${lat},${lon});
      way["shop"~"hardware|doityourself|trade|building_materials"](around:${radiusM},${lat},${lon});
    );
    out center 40;`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return { shops: [], error: `Lookup failed (${res.status})` };
    const json = await res.json();

    const seen = new Set<string>();
    const shops: NearbyShop[] = (json.elements || [])
      .map((el: any) => {
        const elat = el.lat ?? el.center?.lat;
        const elon = el.lon ?? el.center?.lon;
        const name = el.tags?.name;
        if (!elat || !elon || !name) return null;
        return {
          name,
          brand: el.tags?.brand,
          lat: elat,
          lon: elon,
          distanceKm: distanceKm(lat, lon, elat, elon),
        } as NearbyShop;
      })
      .filter((s: NearbyShop | null): s is NearbyShop => {
        if (!s) return false;
        const key = `${s.name}|${s.lat.toFixed(3)}|${s.lon.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: NearbyShop, b: NearbyShop) => a.distanceKm - b.distanceKm)
      .slice(0, 15);

    return { shops, error: null };
  } catch (err) {
    return { shops: [], error: err instanceof Error ? err.message : 'Could not reach the shop lookup service' };
  }
}

/** Maps deep-link URL for a shop (opens Apple/Google Maps). */
export function shopMapsUrl(shop: NearbyShop): string {
  return `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lon}`;
}
