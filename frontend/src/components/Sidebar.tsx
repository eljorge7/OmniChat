"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquareText, Settings, Bot, Users, PieChart, Info, HelpCircle, LogOut, Megaphone, Zap, UserPlus, BrainCircuit, Building2, Menu, X, ChevronLeft, ChevronRight, CalendarDays, Server } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from "react";
import axios from "axios";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const role = (session?.user as any)?.role === 'ADMIN' ? 'Administrador' : 'Agente Ventas';
  const isAdmin = role === 'Administrador';

  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (isAdmin) {
       axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/admin/companies`, {
         headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }
       }).then(res => {
          setCompanies(res.data);
          const savedId = localStorage.getItem('activeCompanyId');
          if (savedId && res.data.some((c: any) => c.id === savedId)) {
             setActiveCompanyId(savedId);
          } else if (res.data.length > 0) {
             setActiveCompanyId(res.data[0].id);
             localStorage.setItem('activeCompanyId', res.data[0].id);
          }
       }).catch(console.error);
    }
  }, [isAdmin]);

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    localStorage.setItem('activeCompanyId', e.target.value);
    setActiveCompanyId(e.target.value);
    window.location.reload();
  };

  const primaryNav = [
    { name: 'Estadísticas / KPIs', href: '/', icon: PieChart, adminOnly: true },
    { name: 'Agencia Maestra', href: '/dashboard', icon: Building2, adminOnly: true },
    { name: 'Bandeja Compartida', href: '/inbox', icon: MessageSquareText, adminOnly: false },
    { name: 'Agenda Global', href: '/calendar', icon: CalendarDays, adminOnly: false },
    { name: 'Directorio Leads', href: '/contacts', icon: Users, adminOnly: false },
    { name: 'Difusión de Marketing', href: '/broadcast', icon: Megaphone, adminOnly: true },
  ];

  const secondaryNav = [
    { name: 'Cerebro IA', href: '/settings/ai', icon: BrainCircuit, adminOnly: true },
    { name: 'Atajos (Hooks)', href: '/settings/quick-replies', icon: Zap, adminOnly: true },
    { name: 'Ajustes del Bot', href: '/bot', icon: Bot, adminOnly: true },
    { name: 'Gestión de Equipo', href: '/settings/team', icon: UserPlus, adminOnly: true },
    { name: 'Bypass WispHub', href: '/settings/wisphub', icon: Server, adminOnly: true },
    { name: 'Dispositivo Base', href: '/settings/whatsapp', icon: Settings, adminOnly: true },
    { name: 'Ayuda', href: '/help', icon: HelpCircle, adminOnly: false },
  ];

  const initials = session?.user?.name ? session.user.name.substring(0, 2).toUpperCase() : 'AG';

  if (pathname === '/login') return null;

  return (
    <>
      {!isOpenMobile && (
        <button 
          onClick={() => setIsOpenMobile(true)}
          className="md:hidden fixed top-3 left-3 z-[60] p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {isOpenMobile && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/50 z-[60]"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside className={`
        fixed md:relative z-[70] h-full flex flex-col bg-white border-r border-slate-200 shrink-0 shadow-sm transition-all duration-300
        ${isOpenMobile ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-[88px]' : 'md:w-[260px]'}
      `}>
        {/* Toggle Collapse Desktop Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-8 bg-white border border-slate-200 rounded-full p-1.5 text-slate-400 hover:text-indigo-600 shadow-sm z-50 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className="p-6 relative">
          {isOpenMobile && (
             <button onClick={() => setIsOpenMobile(false)} className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full">
               <X className="w-4 h-4" />
             </button>
          )}

          <Link href="/" onClick={() => setIsOpenMobile(false)} className={`flex items-center gap-3 mb-6 block w-fit ${isCollapsed ? 'mx-auto justify-center' : ''}`}>
          <div className="bg-indigo-600 p-2.5 rounded-xl flex-shrink-0 shadow-lg shadow-indigo-600/20 transform -rotate-6">
            <MessageSquareText className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && <span className="text-2xl font-black text-slate-900 tracking-tight transition-opacity duration-200">OmniChat</span>}
        </Link>
        
        {isAdmin && companies.length > 0 && !isCollapsed && (
           <div className="relative transition-opacity duration-200">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="h-4 w-4 text-indigo-500" />
             </div>
             <select 
               value={activeCompanyId}
               onChange={handleCompanyChange}
               className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-sm font-bold text-slate-700 appearance-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-sm"
               style={{ backgroundImage: "url('data:image/svg+xml;charset=us-ascii,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundPosition: "right 0.75rem center", backgroundRepeat: "no-repeat", backgroundSize: "1em 1em" }}
             >
               {companies.map(c => (
                 <option key={c.id} value={c.id}>{c.name}</option>
               ))}
             </select>
           </div>
        )}
        {isAdmin && companies.length > 0 && isCollapsed && (
           <div className="flex justify-center mt-6" title="Cambiar Empresa">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-indigo-500 shadow-sm cursor-pointer hover:bg-slate-100" onClick={() => setIsCollapsed(false)}>
                 <Building2 className="h-5 w-5" />
              </div>
           </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-8 no-scrollbar">
        
        <div>
          {!isCollapsed && <p className="px-3 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 transition-opacity duration-200">Plataforma</p>}
          <ul className="space-y-1">
            {primaryNav.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.name : ""}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold ${isCollapsed ? 'justify-center' : ''} ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        
        <div>
          {!isCollapsed && <p className="px-3 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 transition-opacity duration-200">Sistema</p>}
          <ul className="space-y-1">
            {secondaryNav.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.name : ""}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold ${isCollapsed ? 'justify-center' : ''} ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className={`bg-slate-50 rounded-2xl p-4 flex items-center group border border-slate-200/50 hover:border-slate-300 transition-colors cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/settings/profile" className="flex items-center gap-3 flex-1 overflow-hidden">
             <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-200 overflow-hidden" title={session?.user?.name || "User"}>
               {(session?.user as any)?.avatarUrl ? (
                 <img src={(session?.user as any).avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 initials
               )}
             </div>
             {!isCollapsed && (
               <div className="flex flex-col truncate">
                 <span className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{session?.user?.name || 'Cargando...'}</span>
                 <span className="text-xs font-medium text-slate-500 truncate">{role}</span>
               </div>
             )}
          </Link>
          {!isCollapsed && (
            <div className="flex flex-col gap-1 items-center justify-center">
              <ThemeToggle />
              <button onClick={() => signOut()} className="text-slate-400 hover:text-red-500 transition-colors p-2" title="Cerrar Sesión">
                 <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
