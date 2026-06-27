"""
Ước tính dấu chân carbon (CO₂e) của hành trình — có cơ sở khoa học để trích dẫn báo cáo.

CƠ SỞ / NGUỒN HỆ SỐ PHÁT THẢI:
- Đường bộ (per vehicle-km) — UK DESNZ/DEFRA, "Greenhouse gas reporting: conversion
  factors 2023":
    * Ô tô con (average car, xăng/dầu hỗn hợp) ≈ 0.170 kgCO₂e/km.
    * Xe máy nhỏ (≤125cc — đại diện xe máy/xe tay ga phổ biến ở VN) ≈ 0.083 kgCO₂e/km.
    * Xe tải nhẹ ≈ 0.300 kgCO₂e/km.
- Hàng không nội địa (per passenger-km) — DEFRA 2023, "Flights – domestic, average
  passenger" ≈ 0.246 kgCO₂e/pkm (CHƯA gồm radiative forcing; nếu tính RF nhân ~1.9 → ~0.46).
- Xe khách/coach (per passenger-km) — DEFRA 2023 ≈ 0.027 kgCO₂e/pkm.

Tham khảo thêm: IPCC 2006/2019 Guidelines for National GHG Inventories (phương pháp luận
hệ số phát thải); ICAO Carbon Emissions Calculator (ICEC) cho chuyến bay.

GIẢ ĐỊNH (nêu rõ trong báo cáo):
- Phần NỘI VÙNG tính theo quãng đường THẬT (Goong Directions), đơn vị per-vehicle
  (giả định cả nhóm đi chung 1 phương tiện) → so sánh ô tô vs xe máy.
- Phần LIÊN TỈNH (origin↔destination, khứ hồi) tính per-passenger × số người; chọn phương
  thức theo cự ly: ≥ NGƯỠNG km coi như bay nội địa, ngắn hơn coi như xe khách.
"""
import math

# per vehicle-km (DEFRA 2023). Goong gọi xe máy là "bike".
ROAD_KG_PER_KM = {
    "car": 0.170, "taxi": 0.170, "truck": 0.300, "bike": 0.083, "motorbike": 0.083,
}
ROAD_LABEL = {
    "car": "ô tô", "taxi": "taxi", "truck": "xe tải", "bike": "xe máy", "motorbike": "xe máy",
}

# per passenger-km (DEFRA 2023)
FLIGHT_DOMESTIC_KG_PKM = 0.246
COACH_KG_PKM = 0.027
INTERCITY_FLIGHT_THRESHOLD_KM = 500  # >= → bay nội địa; < → xe khách

SOURCE = (
    "UK DESNZ/DEFRA GHG conversion factors 2023 (đường bộ & bay nội địa); "
    "ICAO Carbon Emissions Calculator; IPCC 2006/2019 GHG Inventory Guidelines"
)


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (la1, lo1), (la2, lo2) = a, b
    r = 6371.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp = math.radians(la2 - la1)
    dl = math.radians(lo2 - lo1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def compute(
    local_distance_m: int,
    by_day: list[dict],
    vehicle: str,
    intercity_km: float | None = None,
    passengers: int = 1,
) -> dict | None:
    """Tổng hợp dấu chân carbon. Trả None nếu không có dữ liệu di chuyển nào."""
    local_km = local_distance_m / 1000
    car_f = ROAD_KG_PER_KM["car"]
    moto_f = ROAD_KG_PER_KM["bike"]
    sel_f = ROAD_KG_PER_KM.get(vehicle, car_f)

    local_kg = round(local_km * sel_f, 1)
    for d in by_day:
        d["kg"] = round(d["km"] * sel_f, 1)

    modes = {
        "car": {"label": "ô tô", "factor": car_f, "local_kg": round(local_km * car_f, 1)},
        "motorbike": {"label": "xe máy", "factor": moto_f, "local_kg": round(local_km * moto_f, 1)},
    }

    intercity = None
    if intercity_km and intercity_km > 0:
        rt = intercity_km * 2  # khứ hồi
        pax = max(passengers, 1)
        if intercity_km >= INTERCITY_FLIGHT_THRESHOLD_KM:
            mode, label, f = "flight", "máy bay (nội địa)", FLIGHT_DOMESTIC_KG_PKM
        else:
            mode, label, f = "coach", "xe khách", COACH_KG_PKM
        intercity = {
            "mode": mode, "label": label, "factor": f,
            "distance_km": round(rt, 1), "passengers": pax,
            "kg": round(rt * f * pax, 1),
        }

    if local_distance_m <= 0 and intercity is None:
        return None

    total = round(local_kg + (intercity["kg"] if intercity else 0), 1)
    return {
        "vehicle": vehicle,
        "vehicle_label": ROAD_LABEL.get(vehicle, vehicle),
        "local_km": round(local_km, 1),
        "local_kg": local_kg,
        "modes": modes,
        "by_day": by_day,
        "intercity": intercity,
        "total_kg": total,
        "source": SOURCE,
    }
