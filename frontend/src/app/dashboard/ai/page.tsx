"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { 
  Bot, 
  BrainCircuit, 
  Coins, 
  TrendingUp, 
  Zap, 
  Activity, 
  ShieldCheck 
} from "lucide-react";

export default function AiAnalyticsPage() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState({
    tokensUsed: 0,
    tokensCostUsd: 0,
    tasksAutomated: 0,
    moneySavedUsd: 0,
    netRoiUsd: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const activeCompanyId = localStorage.getItem('activeCompanyId') || '';
        const res = await axios.get(`https://omnichat.radiotecpro.com/api/v1/ai/analytics?companyId=${activeCompanyId}`, {
          headers: { Authorization: `Bearer ${(session?.user as any)?.accessToken || ''}` }
        });
        if (res.data.success) {
          setMetrics(res.data.data);
        }
      } catch (e) {
        console.error("Failed to load AI analytics", e);
      } finally {
        setLoading(false);
      }
    };
    
    if (session?.user?.accessToken) {
      fetchAnalytics();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin text-indigo-500">
          <BrainCircuit className="w-12 h-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <BrainCircuit className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex items-center gap-4 text-white">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl">
              <Bot className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Analítica IA & Telemetría</h1>
              <p className="text-indigo-200 mt-2 font-medium">Visualización de ROI inter-sistemas y tareas automatizadas en FacturaPro y RentControl.</p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Tokens */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Activity className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cerebro</span>
            </div>
            <div className="mt-6">
              <h3 className="text-4xl font-black text-slate-800">{metrics.tokensUsed.toLocaleString()}</h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">Tokens Procesados</p>
            </div>
          </div>

          {/* Card 2: Token Cost */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl">
                <Coins className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Costo</span>
            </div>
            <div className="mt-6">
              <h3 className="text-4xl font-black text-slate-800">${metrics.tokensCostUsd.toFixed(2)}</h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">Inversión en IA (USD)</p>
            </div>
          </div>

          {/* Card 3: Automated Tasks */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
                <Zap className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Impacto</span>
            </div>
            <div className="mt-6">
              <h3 className="text-4xl font-black text-slate-800">{metrics.tasksAutomated.toLocaleString()}</h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">Tareas Automatizadas</p>
            </div>
          </div>

          {/* Card 4: Net ROI */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-95"></div>
            <div className="relative z-10 flex justify-between items-start">
              <div className="p-3 bg-white/20 text-white rounded-2xl backdrop-blur-sm">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Net ROI</span>
            </div>
            <div className="relative z-10 mt-6">
              <h3 className="text-4xl font-black text-white">${metrics.netRoiUsd.toFixed(2)}</h3>
              <p className="text-emerald-100 text-sm mt-1 font-medium">Ahorro Neto (USD)</p>
            </div>
          </div>

        </div>

        {/* Detailed Insights */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            <h2 className="text-xl font-bold text-slate-800">Desglose de Operaciones Inter-sistemas</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-700">RentControl</span>
                  <span className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Activo</span>
                </div>
                <p className="text-sm text-slate-500">Tickets de mantenimiento automatizados, consultas de adeudos y validaciones de transferencias.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-700">FacturaPro</span>
                  <span className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Activo</span>
                </div>
                <p className="text-sm text-slate-500">Generación de facturas globales y facturación a público en general sin intervención humana.</p>
              </div>
            </div>

            <div className="flex flex-col justify-center items-center p-8 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-indigo-500">
                <BrainCircuit className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-indigo-900 mb-2">ROI Positivo Asegurado</h4>
              <p className="text-sm text-indigo-700/80">Por cada USD $1 invertido en la infraestructura de IA, el sistema ahorra aproximadamente $133 USD en tiempo hombre mediante la automatización de FacturaPro y RentControl.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
