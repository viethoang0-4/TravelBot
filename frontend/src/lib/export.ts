/**
 * Export lịch trình ra Image (PNG) hoặc PDF.
 *
 * Cách dùng:
 *   import { exportElementAsImage, exportElementAsPdf } from "@/lib/export";
 *   exportElementAsImage(divRef.current, "DaLat-3N2D");
 *   exportElementAsPdf(divRef.current, "DaLat-3N2D");
 */
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { Borders } from "exceljs";
import { Itinerary } from "@/types/travel";

const safeFileName = (s: string) =>
  s.replace(/[^a-zA-Z0-9-_\u00C0-\u1EF9]/g, "_").slice(0, 80);

async function captureCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
}

export async function exportElementAsImage(
  element: HTMLElement | null,
  filename: string
) {
  if (!element) return;
  const canvas = await captureCanvas(element);
  const link = document.createElement("a");
  link.download = `${safeFileName(filename)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function exportElementAsPdf(
  element: HTMLElement | null,
  filename: string
) {
  if (!element) return;
  const canvas = await captureCanvas(element);
  const imgData = canvas.toDataURL("image/png");

  // A4 portrait, scale image vào bề rộng A4
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 16;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 8;

  pdf.addImage(imgData, "PNG", 8, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - 16;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 8;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 8, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 16;
  }

  pdf.save(`${safeFileName(filename)}.pdf`);
}

/**
 * Sinh file .ics (iCalendar) từ itinerary để user import vào Google Calendar.
 */
export function exportItineraryAsICS(itinerary: Itinerary) {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

  const formatDateTime = (date: string, time: string) => {
    // date: YYYY-MM-DD, time: HH:MM
    const [y, m, d] = date.split("-");
    const [hh, mm] = time.split(":");
    return `${y}${m}${d}T${hh}${mm}00`;
  };

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Compasso//VN//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const day of itinerary.days) {
    for (const act of day.activities) {
      const start = formatDateTime(day.date, act.time);
      // End = start + duration
      const startDate = new Date(`${day.date}T${act.time}:00`);
      const endDate = new Date(startDate.getTime() + act.duration_minutes * 60000);
      const endStr =
        endDate.getFullYear().toString() +
        String(endDate.getMonth() + 1).padStart(2, "0") +
        String(endDate.getDate()).padStart(2, "0") +
        "T" +
        String(endDate.getHours()).padStart(2, "0") +
        String(endDate.getMinutes()).padStart(2, "0") +
        "00";

      lines.push(
        "BEGIN:VEVENT",
        `UID:${act.id}@compasso`,
        `DTSTART:${start}`,
        `DTEND:${endStr}`,
        `SUMMARY:${escape(act.title)}`,
        `DESCRIPTION:${escape(act.description)}`,
        `LOCATION:${escape(act.location.name)}`,
        "END:VEVENT"
      );
    }
  }

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(itinerary.title)}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Excel (.xlsx) ─────────────────────────────────────────────────────────
// Bảng "lên kế hoạch du lịch" quen thuộc: mỗi ngày một nhóm, các cột
// Ngày / Thời gian / Hoạt động / Địa điểm / Loại / Chi phí / Ghi chú + dòng tổng.
// Dùng exceljs, NẠP ĐỘNG để không phình bundle chính (chỉ tải khi bấm xuất).

// Planner LLM không tuân thủ chặt 6 loại chuẩn — nó còn sinh biến thể tiếng Anh
// (sightseeing, leisure, cafe...). Quy hết về nhãn tiếng Việt; loại lạ → "Tham quan"
// (khớp cách UI tự xếp loại không xác định vào nhóm activity).
const _TYPE_LABEL_VI: Record<string, string> = {
  transport: "Di chuyển",
  transportation: "Di chuyển",
  travel: "Di chuyển",
  accommodation: "Lưu trú",
  hotel: "Lưu trú",
  stay: "Lưu trú",
  food: "Ăn uống",
  dining: "Ăn uống",
  meal: "Ăn uống",
  cafe: "Ăn uống",
  coffee: "Ăn uống",
  shopping: "Mua sắm",
  market: "Mua sắm",
  rest: "Thư giãn",
  relax: "Thư giãn",
  relaxation: "Thư giãn",
  leisure: "Thư giãn",
  spa: "Thư giãn",
  wellness: "Thư giãn",
  activity: "Tham quan",
  sightseeing: "Tham quan",
  sightsee: "Tham quan",
  culture: "Tham quan",
  cultural: "Tham quan",
  nature: "Tham quan",
  entertainment: "Giải trí",
  nightlife: "Giải trí",
  adventure: "Trải nghiệm",
  sport: "Vận động",
  sports: "Vận động",
};

function _typeLabel(t: string): string {
  return _TYPE_LABEL_VI[(t || "").toLowerCase().trim()] ?? "Tham quan";
}

const _CELL_BORDER: Partial<Borders> = {
  top: { style: "thin", color: { argb: "FFE7DDD5" } },
  left: { style: "thin", color: { argb: "FFE7DDD5" } },
  bottom: { style: "thin", color: { argb: "FFE7DDD5" } },
  right: { style: "thin", color: { argb: "FFE7DDD5" } },
};

function _dmy(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return d && m && y ? `${d}/${m}/${y}` : dateStr;
}

export async function exportItineraryAsExcel(itinerary: Itinerary) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "Compasso";
  wb.created = new Date();

  const ws = wb.addWorksheet("Lịch trình");
  ws.columns = [
    { key: "day", width: 7 },
    { key: "time", width: 10 },
    { key: "activity", width: 34 },
    { key: "location", width: 28 },
    { key: "type", width: 12 },
    { key: "cost", width: 15 },
    { key: "notes", width: 42 },
  ];

  const nf = new Intl.NumberFormat("vi-VN");

  // Hàng 1: tiêu đề (gộp ô)
  ws.mergeCells("A1:G1");
  const title = ws.getCell("A1");
  title.value = itinerary.title;
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC15F3C" } };
  ws.getRow(1).height = 28;

  // Hàng 2: phụ đề
  ws.mergeCells("A2:G2");
  const sub = ws.getCell("A2");
  sub.value =
    `${itinerary.destination}  •  ${_dmy(itinerary.start_date)} – ${_dmy(itinerary.end_date)}` +
    `  •  ${itinerary.days.length} ngày  •  Tổng dự kiến: ${nf.format(itinerary.budget.total_estimated)} đ`;
  sub.alignment = { vertical: "middle", horizontal: "center" };
  sub.font = { size: 11, color: { argb: "FF7A7A7A" } };
  ws.getRow(2).height = 20;

  // Hàng 4: tiêu đề cột (chừa hàng 3 trống cho thoáng)
  const headers = ["Ngày", "Thời gian", "Hoạt động", "Địa điểm", "Loại", "Chi phí (VND)", "Ghi chú"];
  const head = ws.getRow(4);
  head.height = 20;
  headers.forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C9A82" } };
    cell.border = _CELL_BORDER;
  });

  for (const day of itinerary.days) {
    // Hàng ngăn cách ngày (gộp ô)
    const sepIdx = ws.rowCount + 1;
    ws.mergeCells(`A${sepIdx}:G${sepIdx}`);
    const sep = ws.getCell(`A${sepIdx}`);
    sep.value = `Ngày ${day.day} — ${_dmy(day.date)}${day.theme ? "  •  " + day.theme : ""}`;
    sep.font = { bold: true, color: { argb: "FF3B2E2A" } };
    sep.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4EAE3" } };
    ws.getRow(sepIdx).height = 18;

    for (const act of day.activities) {
      const row = ws.addRow({
        day: day.day,
        time: act.time,
        activity: act.title,
        location: act.location?.name ?? "",
        type: _typeLabel(act.type),
        cost: act.cost_estimate || 0,
        notes: act.tips || act.description || "",
      });
      row.alignment = { vertical: "top", wrapText: true };
      row.getCell("cost").numFmt = "#,##0";
      row.eachCell((cell) => {
        cell.border = _CELL_BORDER;
      });
    }
  }

  // Dòng tổng chi phí
  const total = ws.addRow({
    activity: "TỔNG CHI PHÍ DỰ KIẾN",
    cost: itinerary.budget.total_estimated,
  });
  total.getCell("activity").font = { bold: true };
  const totalCost = total.getCell("cost");
  totalCost.font = { bold: true };
  totalCost.numFmt = "#,##0";

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(itinerary.title)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Chia sẻ qua Web Share API (mobile) hoặc copy URL vào clipboard (desktop) */
export async function shareItinerary(itinerary: Itinerary) {
  const text = `${itinerary.title}\n${itinerary.destination}\n${itinerary.start_date} → ${itinerary.end_date}\n\n${itinerary.summary}`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: itinerary.title, text });
      return;
    } catch {
      // user cancelled — fall through
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    alert("Đã sao chép thông tin lịch trình vào clipboard!");
  }
}
