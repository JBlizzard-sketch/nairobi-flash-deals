/**
 * Haversine geo utilities.
 * All coordinates in decimal degrees; distances in kilometres.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points (Haversine formula).
 */
export function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns true if the user is within radiusKm of the venue.
 */
export function isWithinRadius(
  userLat: number, userLng: number,
  venueLat: number, venueLng: number,
  radiusKm: number
): boolean {
  return distanceKm(userLat, userLng, venueLat, venueLng) <= radiusKm;
}

/**
 * Approximate bounding box for a fast SQL pre-filter before the Haversine check.
 * Returns { minLat, maxLat, minLng, maxLng }.
 */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / EARTH_RADIUS_KM * (180 / Math.PI);
  const lngDelta = latDelta / Math.cos(toRad(lat));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
