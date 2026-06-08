import Navbar from "@/components/layout/Navbar";
import ChatPanel from "@/components/chat/ChatPanel";
import RightPanel from "@/components/layout/RightPanel";
import DraftsBar from "@/components/drafts/DraftsBar";
import ItineraryHydrator from "@/components/drafts/ItineraryHydrator";

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <ItineraryHydrator />
      <Navbar />
      <DraftsBar />

      {/* Main layout: Chat (left) + Right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="w-full md:w-[42%] lg:w-[38%] border-r flex flex-col overflow-hidden shrink-0">
          <ChatPanel />
        </div>

        {/* Right: Timeline / Map / Budget */}
        <div className="hidden md:flex flex-1 flex-col overflow-hidden">
          <RightPanel />
        </div>
      </div>
    </div>
  );
}
