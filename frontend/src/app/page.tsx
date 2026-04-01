"use client";

import { MessageSquareText, Users, AlertCircle, Sparkles, Filter, GitMerge, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";

// StatCard component definition (added to make the provided code syntactically correct)
function StatCard({ title, value, icon: Icon, color, trend }: { title: string; value: string; icon: any; color: string; trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4 hover:shadow-md transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <div className={`h-12 w-12 rounded-full flex items-center justify-center ${color}/20 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <p className="text-sm font-semibold text-slate-400">{trend}</p>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">{title}</p>
        <p className="text-4xl font-black text-slate-800 mt-1">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayChats: 0,
    totalLeads: 0,
    unassigned: 0,
    totalPipelines: 0
  });

  useEffect(() => {
    axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/stats`)
      .then(res => setStats(res.data))
      .catch(err => console.error("Error fetching stats:", err));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500 relative pb-20">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Centro de Comando <Sparkles className="h-6 w-6 text-emerald-500" />
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Control unificado de comunicaciones para RJL Multiservicios.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
            <Filter className="h-4 w-4" />
            Esta Semana
          </button>
        </div>
      </div>

      {/* KPI Cards Reales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Chats de Hoy" value={stats.todayChats.toString()} icon={MessageSquareText} color="bg-indigo-500" trend="Actividad en vivo" />
        <StatCard title="Leads Totales" value={stats.totalLeads.toString()} icon={Users} color="bg-emerald-500" trend="Base de Datos CRM" />
        <StatCard title="Sin Asignar" value={stats.unassigned.toString()} icon={AlertCircle} color={stats.unassigned > 0 ? "bg-rose-500" : "bg-slate-400"} trend={stats.unassigned > 0 ? "¡Requiere atención!" : "Bandeja Limpia"} />
        <StatCard title="Embudos Activos" value={stats.totalPipelines.toString()} icon={GitMerge} color="bg-cyan-500" trend="Departamentos online" />
      </div>

      {/* Recents area MVP */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center py-20 text-center">
        <MessageCircle className="h-16 w-16 text-slate-200 mb-4" />
        <h3 className="text-xl font-bold text-slate-700">Tu bandeja está sincronizada</h3>
        <p className="text-slate-500 mt-2 max-w-md">El motor de enrutamiento WhatsApp está en línea y capturando leads automáticamente en tiempo real.</p>
      </div>
    </div>
  );
}
