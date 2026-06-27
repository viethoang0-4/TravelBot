import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Map,
  Sparkles,
  Navigation,
  Wallet,
  CloudRain,
} from "lucide-react";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-terracotta/20">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 h-20 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-terracotta flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-foreground">
            Compa<span className="text-terracotta">sso</span>
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-muted-foreground">
          <Link href="#features" className="hover:text-foreground transition-colors">Tính năng</Link>
          <Link href="#how-it-works" className="hover:text-foreground transition-colors">Cách hoạt động</Link>
        </nav>
        <Link href="/chat" className="inline-flex items-center justify-center bg-terracotta text-white px-5 h-10 rounded-md font-medium transition-all hover:bg-terracotta-dark">
          Bắt đầu miễn phí
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative px-6 lg:px-12 pt-24 pb-32 overflow-hidden flex flex-col items-center text-center">
          {/* Background decorations */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-terracotta/5 rounded-full blur-3xl -z-10" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sage/5 rounded-full blur-3xl -z-10" />

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-terracotta/10 border border-terracotta/20 text-terracotta text-sm font-semibold mb-8">
            <Sparkles className="w-4 h-4" />
            <span>AI Lên kế hoạch Thông minh</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-[-0.8px] text-foreground max-w-[800px] leading-[1.04] mb-6">
            Thiết kế chuyến đi <br className="hidden md:block" />
            <span className="text-terracotta">trong tích tắc.</span>
          </h1>

          <p className="text-[20px] text-muted-foreground max-w-[600px] leading-[1.5] mb-10 font-medium">
            Tạo lịch trình siêu chuẩn, dự toán ngân sách và khám phá các điểm đến ẩn giấu chỉ bằng một cuộc trò chuyện đơn giản.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center bg-terracotta text-white px-8 h-14 text-base rounded-md font-medium shadow-wf hover:bg-terracotta-dark transition-colors"
            >
              Lên lịch trình ngay
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center justify-center bg-transparent border border-border text-foreground px-8 h-14 text-base rounded-md font-medium hover:border-clay transition-colors"
            >
              Xem Demo
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-6 lg:px-12 py-24 bg-card border-y border-border">
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-[32px] md:text-[56px] font-bold text-foreground leading-[1.04] mb-4">
                Trải nghiệm du lịch 2.0
              </h2>
              <p className="text-[20px] text-muted-foreground font-medium">
                Mọi thứ bạn cần để tạo nên một chuyến đi trọn vẹn, không cần tốn nhiều giờ tìm kiếm.
              </p>
            </div>

            <BentoGrid>
              <BentoCard
                className="md:col-span-2"
                icon={Navigation}
                accent="shop"
                title="Lịch Trình Động"
                description="Tuỳ biến từng địa điểm, kéo thả linh hoạt và chỉnh sửa thời gian chuyến hành trình theo đúng ý thích của bạn. Các sự kiện cố định như chuyến bay, nhận phòng được khoá để tránh xáo trộn."
              />
              <BentoCard
                icon={Map}
                accent="sage"
                title="Bản Đồ Việt Nam"
                description="Bản đồ Goong chuẩn chủ quyền, hiển thị vị trí từng hoạt động và cập nhật tức thì."
              />
              <BentoCard
                icon={Sparkles}
                accent="terracotta"
                title="Gợi Ý Địa Điểm Ẩn"
                description="Khám phá những trải nghiệm độc đáo, ít người biết được AI phân tích theo sở thích của bạn."
              />
              <BentoCard
                icon={Wallet}
                accent="fun"
                title="Dự Toán Ngân Sách"
                description="Tự động ước tính chi phí ăn ở, di chuyển, vui chơi theo từng hạng mục."
              />
              <BentoCard
                icon={CloudRain}
                accent="transport"
                title="Cảnh Báo Thời Tiết"
                description="Theo dõi dự báo và nhắc bạn khi hoạt động ngoài trời gặp thời tiết bất lợi."
              />
            </BentoGrid>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border">
        <p className="font-medium">© 2026 Compasso. AI-powered Travel Assistant.</p>
      </footer>
    </div>
  );
}
