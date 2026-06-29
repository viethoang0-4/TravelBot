"use client";

import { useEffect, useMemo, useRef } from "react";
import goongjs from "@goongmaps/goong-js";
import "@goongmaps/goong-js/dist/goong-js.css";
import { useTravelStore, useActiveItinerary } from "@/store/travel-store";
import { ActivityType, DayRoute, Location } from "@/types/travel";
import { decodePolyline } from "@/lib/polyline";

// Maptiles Key (khác với API key REST) — lấy free tại https://account.goong.io
const MAPTILES_KEY = process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY ?? "";
// Goong thể hiện ĐÚNG chủ quyền VN (Hoàng Sa/Trường Sa, không có đường lưỡi bò)
const STYLE_URL = "https://tiles.goong.io/assets/goong_map_web.json";
const VN_CENTER: [number, number] = [107.5, 16.0]; // [lng, lat]

const TYPE_COLORS: Record<ActivityType, string> = {
  transport: "#5B8AA5",
  accommodation: "#A87BA0",
  food: "#D64550",
  activity: "#C9A961",
  shopping: "#C77E8A",
  rest: "#87A878",
};

function isValidCoord(loc: Location): boolean {
  return (
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng) &&
    !(loc.lat === 0 && loc.lng === 0)
  );
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function buildMarkerEl(color: string, label: number): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = String(label);
  Object.assign(el.style, {
    width: "26px",
    height: "26px",
    borderRadius: "9999px",
    background: color,
    border: "2px solid #fff",
    color: "#fff",
    fontWeight: "700",
    fontSize: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all .15s",
    boxShadow: "0 1px 3px rgba(0,0,0,.3)",
  } as Partial<CSSStyleDeclaration>);
  return el;
}

function setActiveStyle(el: HTMLElement, color: string, active: boolean) {
  el.style.width = active ? "34px" : "26px";
  el.style.height = active ? "34px" : "26px";
  el.style.fontSize = active ? "13px" : "11px";
  el.style.boxShadow = active
    ? `0 0 0 4px ${color}55, 0 1px 3px rgba(0,0,0,.3)`
    : "0 1px 3px rgba(0,0,0,.3)";
  el.style.zIndex = active ? "10" : "1";
}

export default function GoongMap() {
  const itinerary = useActiveItinerary();
  const selectedActivityId = useTravelStore((s) => s.selectedActivityId);
  const hoveredActivityId = useTravelStore((s) => s.hoveredActivityId);
  const setSelectedActivity = useTravelStore((s) => s.setSelectedActivity);
  const setHoveredActivity = useTravelStore((s) => s.setHoveredActivity);

  const containerRef = useRef<HTMLDivElement>(null);
  // goong-js không có type declarations → dùng any cho instance
  const mapRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const markersRef = useRef<Map<string, any>>(new Map());
  const elsRef = useRef<Map<string, { el: HTMLElement; color: string }>>(new Map());

  // Gom activity theo ngày (giữ thứ tự), đánh số chạy toàn hành trình
  const dayGroups = useMemo(() => {
    let counter = 0;
    return (itinerary?.days ?? []).map((day) => ({
      day: day.day,
      route: day.route as DayRoute | undefined,
      acts: day.activities
        .filter((a) => isValidCoord(a.location))
        .map((a) => ({ act: a, index: ++counter })),
    }));
  }, [itinerary]);

  // Khởi tạo map một lần
  useEffect(() => {
    if (!containerRef.current || !MAPTILES_KEY) return;
    goongjs.accessToken = MAPTILES_KEY;
    const map = new goongjs.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: VN_CENTER,
      zoom: 5,
    });
    map.addControl(new goongjs.NavigationControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      loadedRef.current = true;
      // Style Goong tham chiếu source-layer "trees" không tồn tại trên vector tiles
      // → goong-js log "Source layer 'trees' does not exist". Gỡ layer đó cho sạch console.
      try {
        const layers: { id: string; "source-layer"?: string }[] =
          map.getStyle()?.layers ?? [];
        layers.forEach((l) => {
          if (l["source-layer"] === "trees" && map.getLayer(l.id)) {
            map.removeLayer(l.id);
          }
        });
      } catch {
        /* style chưa sẵn sàng — bỏ qua */
      }
      if (!map.getSource("routes")) {
        map.addSource("routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        // Tuyến đường THẬT từ Goong Directions (bám đường phố) → nét liền đậm.
        map.addLayer({
          id: "routes-real",
          type: "line",
          source: "routes",
          filter: ["==", "real", true],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#D64550", "line-width": 4, "line-opacity": 0.85 },
        });
        // Fallback nối thẳng (chưa có route thật / đã kéo-thả đổi chỗ) → nét đứt mờ.
        map.addLayer({
          id: "routes-est",
          type: "line",
          source: "routes",
          filter: ["==", "real", false],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#9CA3AF",
            "line-width": 3,
            "line-opacity": 0.5,
            "line-dasharray": [1.5, 1.5],
          },
        });
      }
    });
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      markersRef.current.clear();
      elsRef.current.clear();
    };
  }, []);

  // Vẽ marker + đường nối + fit bounds khi dữ liệu đổi
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      elsRef.current.clear();

      const coords: [number, number][] = [];
      dayGroups.forEach((g) =>
        g.acts.forEach(({ act, index }) => {
          const lngLat: [number, number] = [act.location.lng, act.location.lat];
          coords.push(lngLat);
          const color = TYPE_COLORS[act.type] ?? "#8B7B6B";
          const el = buildMarkerEl(color, index);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedActivity(act.id);
          });
          el.addEventListener("mouseenter", () => setHoveredActivity(act.id));
          el.addEventListener("mouseleave", () => setHoveredActivity(null));
          const popup = new goongjs.Popup({ offset: 18, closeButton: false }).setHTML(
            `<div style="font-size:12px;line-height:1.4">
               <div style="font-weight:600">${index}. ${escapeHtml(act.title)}</div>
               <div style="color:#666">${escapeHtml(act.location.name)}</div>
               <div style="color:#666">Ngày ${g.day} · ${escapeHtml(act.time)}${
              act.cost_estimate > 0
                ? ` · ${(act.cost_estimate / 1000).toFixed(0)}k VND`
                : ""
            }</div>
             </div>`
          );
          const marker = new goongjs.Marker({ element: el, anchor: "center" })
            .setLngLat(lngLat)
            .setPopup(popup)
            .addTo(map);
          markersRef.current.set(act.id, marker);
          elsRef.current.set(act.id, { el, color });
        })
      );

      const features = dayGroups
        .filter((g) => g.acts.length > 1)
        .map((g) => {
          const curIds = g.acts.map((x) => x.act.id);
          // Dùng TUYẾN ĐƯỜNG THẬT (Goong) nếu có & thứ tự khớp (chưa bị kéo-thả đổi chỗ);
          // ngược lại fallback nối thẳng theo tọa độ hiện tại.
          const real =
            g.route?.polyline &&
            g.route.seq.length === curIds.length &&
            g.route.seq.every((id, i) => id === curIds[i]);
          const coordinates = real
            ? decodePolyline(g.route!.polyline)
            : g.acts.map((x) => [x.act.location.lng, x.act.location.lat]);
          return {
            type: "Feature" as const,
            properties: { real: !!real },
            geometry: { type: "LineString" as const, coordinates },
          };
        });
      const src = map.getSource("routes");
      if (src) src.setData({ type: "FeatureCollection", features });

      if (coords.length === 1) {
        map.easeTo({ center: coords[0], zoom: 14 });
      } else if (coords.length > 1) {
        const bounds = new goongjs.LngLatBounds(coords[0], coords[0]);
        coords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 600 });
      }
    };

    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [dayGroups, setSelectedActivity, setHoveredActivity]);

  // Phóng to marker đang chọn/hover
  useEffect(() => {
    elsRef.current.forEach(({ el, color }, id) => {
      setActiveStyle(el, color, id === selectedActivityId || id === hoveredActivityId);
    });
  }, [selectedActivityId, hoveredActivityId]);

  // Chọn activity ở nơi khác (timeline) → bay tới marker + mở popup
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedActivityId) return;
    const marker = markersRef.current.get(selectedActivityId);
    if (marker) {
      map.flyTo({
        center: marker.getLngLat(),
        zoom: Math.max(map.getZoom(), 14),
        duration: 600,
      });
      const popup = marker.getPopup();
      if (popup && !popup.isOpen()) marker.togglePopup();
    }
  }, [selectedActivityId]);

  if (!MAPTILES_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Thêm{" "}
          <code className="bg-muted px-1 rounded">NEXT_PUBLIC_GOONG_MAPTILES_KEY</code>{" "}
          vào <code className="bg-muted px-1 rounded">.env.local</code> để hiển thị bản
          đồ Goong (đúng chủ quyền Việt Nam).
        </p>
        <a
          href="https://account.goong.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-terracotta hover:underline"
        >
          Lấy Maptiles Key miễn phí tại account.goong.io →
        </a>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
