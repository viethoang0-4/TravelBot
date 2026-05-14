"use client";

import { useActiveItinerary } from "@/store/travel-store";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CalendarDays, Wallet } from "lucide-react";

// Warm earthy palette matching activity type colors
const COLORS = ["#A87BA0", "#5B8AA5", "#D97757", "#C9A961", "#87A878"];

const LABELS: Record<string, string> = {
  accommodation: "Lưu trú",
  transport: "Di chuyển",
  food: "Ăn uống",
  activities: "Hoạt động",
  misc: "Khác",
};

function formatVND(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}tr`;
  return `${(n / 1000).toFixed(0)}k`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { percent: number } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-popover border border-border rounded-md shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-muted-foreground">{formatVND(item.value)} VND</p>
      <p className="text-xs text-terracotta font-bold">
        {(item.payload.percent * 100).toFixed(1)}%
      </p>
    </div>
  );
}

export default function BudgetChart() {
  const itinerary = useActiveItinerary();

  if (!itinerary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-sm bg-muted flex items-center justify-center">
          <Wallet className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Tạo lịch trình để xem phân tích ngân sách
        </p>
      </div>
    );
  }

  const { budget } = itinerary;
  const data = Object.entries(budget.breakdown).map(([key, value]) => ({
    name: LABELS[key] ?? key,
    value,
    percent: value / budget.total_estimated,
  }));

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Summary card — flat with accent border */}
      <div className="bg-card border border-border border-l-4 border-l-terracotta rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-5 h-5 text-terracotta" />
          <span className="font-bold text-foreground">Tổng ngân sách ước tính</span>
        </div>
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {(budget.total_estimated / 1000000).toFixed(1)}
          <span className="text-lg font-medium ml-1 text-muted-foreground">triệu VND</span>
        </p>
        <div className="flex items-center gap-2 mt-1 text-muted-foreground text-xs">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>
            ~{(budget.total_estimated / itinerary.days.length / 1000000).toFixed(1)}tr/ngày · {itinerary.days.length} ngày
          </span>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown List */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Chi tiết ngân sách
        </p>
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{item.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.percent * 100}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right font-semibold">
                  {formatVND(item.value)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="bg-sand/50 dark:bg-secondary border border-sand dark:border-border rounded-sm p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-terracotta mb-2">
          Lưu ý
        </p>
        <p className="text-xs text-foreground leading-relaxed">
          Đây là ước tính dựa trên mức giá trung bình. Chi phí thực tế có thể thay đổi tùy thời điểm, mùa vụ và lựa chọn cá nhân.
        </p>
      </div>
    </div>
  );
}
