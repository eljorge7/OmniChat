"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import HelpCenterOverlay from "@/components/HelpCenterOverlay";
import WelcomeTourModal from "@/components/WelcomeTourModal";
import WhatsAppWidget from "@/components/WhatsAppWidget";
import { AppLauncher } from "@/components/AppLauncher";

export default function LayoutClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Exclude public routes and settings pages if needed. Only /rifas/ (but not /settings/rifas)
  // Check if it matches exactly /rifas/[id]/[id] format. Actually just checking if it starts with /rifas/ and not /settings/rifas
  const isPublicRoute = pathname?.startsWith("/rifas/");

  if (isPublicRoute) {
    return (
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-[#0B1120]">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden w-full max-w-full">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col h-full relative z-0 overflow-y-auto">
        <div className="fixed top-4 right-4 z-[9999]">
          <AppLauncher currentApp="OmniChat" />
        </div>
        {children}
        <HelpCenterOverlay />
        <WelcomeTourModal />
        <WhatsAppWidget />
      </main>
    </div>
  );
}
