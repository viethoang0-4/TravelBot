"use client";

import { useEffect, useState } from "react";
import { Activity } from "@/types/travel";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTravelStore } from "@/store/travel-store";
import { isActivityLocked } from "@/lib/activity-lock";
import { useResolvedImage } from "@/lib/use-pexels-image";
import {
  Bed,
  Camera,
  Clock,
  Coffee,
  GripVertical,
  Lock,
  MapPin,
  Plane,
  ShoppingBag,
  Star,
  Utensils,
  Wallet,
  Gem,
  Lightbulb,
  CloudLightning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TYPE_CONFIG = {
  transport: {
    icon: Plane,
    color: "text-acc-transport",
    bg: "bg-acc-transport",
    label: "Di chuyển",
  },
  accommodation: {
    icon: Bed,
    color: "text-acc-stay",
    bg: "bg-acc-stay",
    label: "Lưu trú",
  },
  food: {
    icon: Utensils,
    color: "text-acc-food",
    bg: "bg-acc-food",
    label: "Ăn uống",
  },
  activity: {
    icon: Camera,
    color: "text-acc-fun",
    bg: "bg-acc-fun",
    label: "Tham quan",
  },
  shopping: {
    icon: ShoppingBag,
    color: "text-acc-shop",
    bg: "bg-acc-shop",
    label: "Mua sắm",
  },
  rest: {
    icon: Coffee,
    color: "text-acc-rest",
    bg: "bg-acc-rest",
    label: "Thư giãn",
  },
} as const;

function formatCost(amount: number): string {
  if (amount === 0) return "Miễn phí";
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}tr`;
  return `${(amount / 1000).toFixed(0)}k`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}p`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}g${m}p` : `${h}g`;
}

interface Props {
  activity: Activity;
  sortable?: boolean;
  /** Điểm đến của lịch trình — dùng làm "vùng" khi tra ảnh theo loại */
  region?: string;
}

export default function ActivityCard({
  activity,
  sortable = false,
  region = "",
}: Props) {
  const selectedActivityId = useTravelStore((s) => s.selectedActivityId);
  const hoveredActivityId = useTravelStore((s) => s.hoveredActivityId);
  const setSelectedActivity = useTravelStore((s) => s.setSelectedActivity);
  const setHoveredActivity = useTravelStore((s) => s.setHoveredActivity);
  const setActiveTab = useTravelStore((s) => s.setActiveTab);
  const hasWeatherAlert = useTravelStore((s) =>
    s.notifications.some(
      (n) => !n.read && n.activity_id === activity.id && n.severity !== "info"
    )
  );

  const [imgFailed, setImgFailed] = useState(false);

  const isSelected = selectedActivityId === activity.id;
  const isHovered = hoveredActivityId === activity.id;
  const isLocked = isActivityLocked(activity);
  const config = TYPE_CONFIG[activity.type] || TYPE_CONFIG.activity;
  const Icon = config.icon;

  // Ảnh: image_url thật → image_query (LLM) → tên địa điểm (có xác thực) → loại+vùng → loại chung
  const resolvedSrc = useResolvedImage(
    activity.location.name || activity.title,
    region,
    activity.type,
    activity.id,
    activity.image_url,
    activity.image_query
  );
  const showImage = !!resolvedSrc && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedSrc]);

  const sortableProps = useSortable({
    id: activity.id,
    disabled: !sortable || isLocked,
  });
  const style = {
    transform: CSS.Transform.toString(sortableProps.transform),
    transition: sortableProps.transition,
    opacity: sortableProps.isDragging ? 0.5 : 1,
  };

  const rating = activity.rating ?? 4 + Math.random() * 1;

  const handleViewOnMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedActivity(activity.id);
    setActiveTab("map");
  };

  const handleClick = () => {
    setSelectedActivity(isSelected ? null : activity.id);
  };

  return (
    <div
      ref={sortable ? sortableProps.setNodeRef : undefined}
      style={sortable ? style : undefined}
      data-activity-id={activity.id}
      onClick={handleClick}
      onMouseEnter={() => setHoveredActivity(activity.id)}
      onMouseLeave={() => setHoveredActivity(null)}
      className={cn(
        "group relative rounded-lg border bg-card overflow-hidden cursor-pointer transition-all duration-200 shadow-sm",
        "hover:shadow-md hover:-translate-y-0.5",
        isSelected && "ring-2 ring-terracotta shadow-md",
        isHovered && !isSelected && "ring-1 ring-terracotta/50 shadow-md",
        isLocked && "ring-1 ring-clay/20"
      )}
    >
      {/* Hero image (ảnh thật nếu có image_url hợp lệ, ngược lại placeholder) */}
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-sand to-cream">
        {showImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={resolvedSrc}
            alt={activity.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className={cn(
              "w-full h-full flex items-center justify-center",
              config.bg
            )}
          >
            <Icon className="w-12 h-12 text-white/40" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Type icon (top-left) */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <div
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center text-white shadow-md",
              config.bg
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-medium text-white bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-sm">
            {config.label}
          </span>
        </div>

        {/* Badges (top-right) — non-sortable mode */}
        {!sortable && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {hasWeatherAlert && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge className="bg-[#ff6b00] text-white border-0 text-[10px] px-1.5 py-0 rounded-sm cursor-help">
                      <CloudLightning className="w-2.5 h-2.5 mr-0.5" />
                      Thời tiết
                    </Badge>
                  }
                />
                <TooltipContent side="left">
                  Hoạt động này có thể bị ảnh hưởng bởi thời tiết — kiểm tra dự báo trước khi đi
                </TooltipContent>
              </Tooltip>
            )}
            {activity.is_hidden_gem && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge className="bg-acc-food text-white border-0 text-[10px] px-1.5 py-0 rounded-sm cursor-help">
                      <Gem className="w-2.5 h-2.5 mr-0.5" />
                      Điểm ẩn
                    </Badge>
                  }
                />
                <TooltipContent side="left">
                  Địa điểm ẩn ít người biết — gợi ý riêng từ AI
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Drag handle or Lock icon (top-right when sortable) */}
        {sortable && (
          isLocked ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-md bg-black/40 backdrop-blur-sm text-white/70 flex items-center justify-center cursor-not-allowed">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                }
              />
              <TooltipContent side="left">
                Sự kiện cố định (di chuyển/lưu trú) — không thể đổi chỗ
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              {activity.is_hidden_gem && (
                <Badge className="absolute top-2 right-10 bg-acc-food text-white border-0 text-[10px] px-1.5 py-0 rounded-sm">
                  <Gem className="w-2.5 h-2.5 mr-0.5" />
                  Điểm ẩn
                </Badge>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      {...sortableProps.attributes}
                      {...sortableProps.listeners}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 w-7 h-7 rounded-md bg-black/40 backdrop-blur-sm text-white flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent side="left">
                  Kéo để đổi thứ tự hoạt động
                </TooltipContent>
              </Tooltip>
            </>
          )
        )}

        {/* Title overlay (bottom) */}
        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="text-white font-semibold text-sm leading-tight line-clamp-1 drop-shadow">
            {activity.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-0.5 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
              <Star className="w-2.5 h-2.5 text-acc-fun fill-acc-fun" />
              <span className="text-[10px] text-white font-medium">
                {rating.toFixed(1)}
              </span>
            </div>
            <span className="text-[10px] text-white/90 truncate">
              <MapPin className="w-2.5 h-2.5 inline mr-0.5" />
              {activity.location.name}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {activity.description}
        </p>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {activity.time} · {formatDuration(activity.duration_minutes)}
          </span>
          <span className="flex items-center gap-1">
            <Wallet className="w-3 h-3" />
            {formatCost(activity.cost_estimate)}
          </span>
        </div>

        {/* Tip — only when selected */}
        {isSelected && activity.tips && (
          <div className="mt-2 flex items-start gap-1.5 bg-sand border border-clay/20 rounded-sm p-2">
            <Lightbulb className="w-3.5 h-3.5 text-terracotta shrink-0 mt-0.5" />
            <span className="text-xs text-foreground">
              {activity.tips}
            </span>
          </div>
        )}

        {/* View on map button */}
        <button
          onClick={handleViewOnMap}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-sm border border-terracotta/30 text-terracotta hover:bg-terracotta/10 transition-all"
        >
          <MapPin className="w-3 h-3" />
          Xem trên bản đồ
        </button>
      </div>
    </div>
  );
}
