"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = pathname === "/login" || pathname.startsWith("/rifas/");

  useEffect(() => {
    if (status === "unauthenticated" && !isPublicRoute) {
      router.push("/login");
    }
    if (status === "authenticated" && pathname === "/login") {
      router.push("/");
    }
  }, [status, pathname, router, isPublicRoute]);

  if (status === "loading") {
    return (
      <div className="flex-1 h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (status === "unauthenticated" && !isPublicRoute) {
    return (
      <div className="flex-1 h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (status === "unauthenticated" && isPublicRoute) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
