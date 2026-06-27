import { cn } from "@/lib/utils";

export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[14rem]",
        className
      )}
    >
      {children}
    </div>
  );
}

export type BentoAccent =
  | "terracotta"
  | "sage"
  | "fun"
  | "shop"
  | "transport"
  | "stay";

/**
 * Map literal (Tailwind JIT quét được — KHÔNG dùng `bg-${var}` động vì sẽ
 * không sinh ra CSS).
 */
const ACCENTS: Record<BentoAccent, { glow: string; wrap: string; icon: string }> = {
  terracotta: { glow: "bg-terracotta", wrap: "bg-terracotta/10", icon: "text-terracotta" },
  sage: { glow: "bg-sage", wrap: "bg-sage/10", icon: "text-sage" },
  fun: { glow: "bg-acc-fun", wrap: "bg-acc-fun/10", icon: "text-acc-fun" },
  shop: { glow: "bg-acc-shop", wrap: "bg-acc-shop/10", icon: "text-acc-shop" },
  transport: { glow: "bg-acc-transport", wrap: "bg-acc-transport/10", icon: "text-acc-transport" },
  stay: { glow: "bg-acc-stay", wrap: "bg-acc-stay/10", icon: "text-acc-stay" },
};

interface BentoCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent?: BentoAccent;
  /** Dùng để set col-span/row-span của ô trong lưới */
  className?: string;
}

/**
 * Ô bento (Joly UI "Bento Grid"): icon trong khối bo tròn, tiêu đề + mô tả,
 * vầng sáng accent hiện khi hover.
 */
export function BentoCard({
  icon: Icon,
  title,
  description,
  accent = "terracotta",
  className,
}: BentoCardProps) {
  const c = ACCENTS[accent];
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-background p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-wf",
        className
      )}
    >
      {/* Vầng sáng accent khi hover */}
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30",
          c.glow
        )}
      />

      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
          c.wrap
        )}
      >
        <Icon className={cn("h-6 w-6", c.icon)} />
      </div>

      <div className="relative mt-4">
        <h3 className="text-xl font-semibold leading-tight text-foreground md:text-2xl">
          {title}
        </h3>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
