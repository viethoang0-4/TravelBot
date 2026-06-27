/**
 * Giải mã polyline (Google/Goong encoded polyline, precision 5) → mảng [lng, lat]
 * để đưa thẳng vào GeoJSON LineString của goong-js.
 *
 * Backend (grounding node) lưu `day.route.polyline` ở dạng encoded để gọn; FE giải mã
 * để vẽ TUYẾN ĐƯỜNG THẬT (bám theo đường phố) thay vì đường thẳng nối các điểm.
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coords: [number, number][] = [];
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / factor, lat / factor]); // [lng, lat] cho GeoJSON
  }
  return coords;
}
