"use client";

import React, { useState } from 'react';
import { Truck, Search, Plus, MapPin, Clock, Calendar, CheckCircle, Navigation, LayoutDashboard, Settings } from 'lucide-react';
import KanbanBoard from '@/components/field-service/KanbanBoard';

export default function FieldServiceDashboard() {
  const [activeTab, setActiveTab] = useState<'kanban' | 'list'>('kanban');

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="px-6 py-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Despacho de Servicios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Control de tráfico y técnicos en campo</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar ticket, técnico o cliente..." 
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo Ticket
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4 shrink-0">
        {[
          { label: 'Sin Asignar', count: 3, icon: LayoutDashboard, color: 'text-slate-600', bg: 'bg-slate-100' },
          { label: 'Programados', count: 5, icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-100' },
          { label: 'En Progreso', count: 4, icon: Navigation, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Completados Hoy', count: 12, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className={`p-3 rounded-lg ${stat.bg} ${stat.color} dark:bg-opacity-20`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stat.count}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'kanban' && <KanbanBoard />}
        {activeTab === 'list' && (
          <div className="p-6 flex items-center justify-center h-full text-slate-500">
            Vista de lista en construcción...
          </div>
        )}
      </div>
    </div>
  );
}
