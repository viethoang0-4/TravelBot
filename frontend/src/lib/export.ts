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
    "PRODID:-//TravelBot//VN//EN",
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
        `UID:${act.id}@travelbot`,
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
