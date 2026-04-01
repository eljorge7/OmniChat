"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.push("/login");
    }
    if (status === "authenticated" && pathname === "/login") {
      router.push("/");
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return (
      <div className="flex-1 h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (status === "unauthenticated" && pathname !== "/login") {
    return (
      <div className="flex-1 h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Si estamos en /login y estamos unauthenticated, SI debemos renderizar a los hijos (el formulario)
  if (status === "unauthenticated" && pathname === "/login") {
    return <>{children}</>;
  }

  return <>{children}</>;
}
