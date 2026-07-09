"use client";

import { useState, useRef, useEffect } from "react";
import { LayoutGrid, MessageSquareText, Building2, Receipt } from "lucide-react";
import Link from "next/link";

export function AppLauncher({ currentApp }: { currentApp: "OmniChat" | "RentControl" | "FacturaPro" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const apps = [
    {
      name: "OmniChat",
      id: "OmniChat",
      icon: MessageSquareText,
      color: "bg-indigo-600",
      href: "https://omnichat.radiotecpro.com/"
    },
    {
      name: "RentControl",
      id: "RentControl",
      icon: Building2,
      color: "bg-emerald-600",
      href: "https://radiotecpro.com/admin"
    },
    {
      name: "FacturaPro",
      id: "FacturaPro",
      icon: Receipt,
      color: "bg-fuchsia-600",
      // MVP link. To implement full SSO, we would generate the token dynamically here or redirect to an API endpoint that handles the SSO token generation and redirects.
      href: "https://facturapro.radiotecpro.com/dashboard" 
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl transition-all duration-200 ${isOpen ? 'bg-slate-200 text-indigo-700 shadow-inner' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-indigo-600'} border border-slate-200`}
        title="Magia OS Apps"
      >
        <LayoutGrid className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-72 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 z-[100] overflow-hidden left-0 md:left-auto md:right-0 transform origin-top-right">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Ecosistema Magia OS</h3>
          </div>
          <div className="p-3 grid grid-cols-3 gap-2">
            {apps.map((app) => (
              <a
                key={app.id}
                href={app.id === currentApp ? "#" : app.href}
                className={`flex flex-col items-center justify-center p-3 rounded-xl gap-2 transition-all duration-200 
                  ${app.id === currentApp 
                    ? 'bg-slate-50 border-2 border-indigo-100 cursor-default opacity-80' 
                    : 'hover:bg-slate-50 border-2 border-transparent hover:border-slate-100 active:scale-95'}`}
              >
                <div className={`${app.color} p-2.5 rounded-xl shadow-sm text-white transform transition-transform ${app.id !== currentApp ? 'hover:-translate-y-0.5' : ''}`}>
                  <app.icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-bold text-center ${app.id === currentApp ? 'text-indigo-600' : 'text-slate-600'}`}>
                  {app.name}
                </span>
              </a>
            ))}
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
             <a href="https://radiotecpro.com" target="_blank" rel="noreferrer" className="text-[10px] font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                Administrar mi Cuenta Radiotec
             </a>
          </div>
        </div>
      )}
    </div>
  );
}
