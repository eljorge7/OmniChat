"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { format, addDays, startOfWeek, subWeeks, addWeeks, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, MapPin, User, Clock, Trash2 } from "lucide-react";

export default function CalendarPage() {
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  
  // Modal de Crear Cita
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", date: format(new Date(), "yyyy-MM-dd"), time: "10:00", pipelineId: "" });
  const [pipelines, setPipelines] = useState<any[]>([]);

  useEffect(() => {
    const cid = localStorage.getItem("activeCompanyId") || "";
    setActiveCompanyId(cid);
    
    if (cid) {
      fetchEvents(cid, currentWeek);
      // Fetch Pipelines para color-coding
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox?companyId=${cid}`)
        .then(res => setPipelines(res.data.pipelines || []))
        .catch(console.error);
    }
  }, [currentWeek]);

  const fetchEvents = (cid: string, weekDate: Date) => {
    const start = format(startOfWeek(weekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = format(addDays(startOfWeek(weekDate, { weekStartsOn: 1 }), 6), "yyyy-MM-dd");
    
    axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${cid}?start=${start}&end=${end}`)
      .then(res => setEvents(res.data))
      .catch(console.error);
  };

  const handlePrevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const handleNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const getColorClass = (bgKey: string) => {
    const c = bgKey.toLowerCase();
    if (c.includes('radiotec')) return 'border-blue-400 bg-blue-50 text-blue-900 border-l-4';
    if (c.includes('rent')) return 'border-emerald-400 bg-emerald-50 text-emerald-900 border-l-4';
    if (c.includes('lavado')) return 'border-orange-400 bg-orange-50 text-orange-900 border-l-4';
    return 'border-indigo-400 bg-indigo-50 text-indigo-900 border-l-4'; // Default
  }

  const handleCreate = async () => {
    if (!newEvent.title) return alert("Ponle título al servicio");
    const startObj = new Date(`${newEvent.date}T${newEvent.time}:00`);
    const endObj = new Date(startObj.getTime() + 60*60*1000); // +1 Hora default

    await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${activeCompanyId}`, {
      title: newEvent.title,
      description: newEvent.description,
      startTime: startObj.toISOString(),
      endTime: endObj.toISOString(),
      pipelineId: newEvent.pipelineId || null
    });
    
    setIsModalOpen(false);
    fetchEvents(activeCompanyId, currentWeek);
  };

  const handleDelete = async (id: string) => {
    if(confirm('¿Eliminar esta cita?')) {
       await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${activeCompanyId}/${id}`);
       fetchEvents(activeCompanyId, currentWeek);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto w-full h-full flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-indigo-600" />
            Agenda Global Operativa
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Control unificado de cuadrillas técnicas y mantenimientos.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <button onClick={handlePrevWeek} className="p-3 hover:bg-slate-50 text-slate-600 transition-colors border-r border-slate-100"><ChevronLeft className="h-5 w-5" /></button>
            <div className="px-6 font-bold text-slate-700 capitalize">
               {format(weekStart, 'MMMM yyyy', { locale: es })}
            </div>
            <button onClick={handleNextWeek} className="p-3 hover:bg-slate-50 text-slate-600 transition-colors border-l border-slate-100"><ChevronRight className="h-5 w-5" /></button>
          </div>
          
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5">
            <Plus className="h-5 w-5" /> Nueva Cita
          </button>
        </div>
      </div>

      {/* WEEK GRID */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
          {days.map((day, idx) => (
            <div key={idx} className="p-4 text-center border-r last:border-0 border-slate-200">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{format(day, 'EEEE', { locale: es })}</span>
              <span className={`text-2xl font-black ${isSameDay(day, new Date()) ? 'text-indigo-600 bg-indigo-50 rounded-lg inline-block px-3 py-1' : 'text-slate-700'}`}>
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>

        {/* Days Content */}
        <div className="grid grid-cols-7 flex-1 min-h-[600px]">
          {days.map((day, idx) => {
             const dayEvents = events.filter(e => isSameDay(new Date(e.startTime), day));
             
             return (
               <div 
                 key={idx} 
                 className="border-r last:border-0 border-slate-200 p-3 bg-white hover:bg-slate-50/50 transition-colors space-y-3 cursor-pointer"
                 onContextMenu={(e) => {
                   e.preventDefault();
                   setNewEvent({ ...newEvent, date: format(day, "yyyy-MM-dd") });
                   setIsModalOpen(true);
                 }}
               >
                 {dayEvents.map(ev => {
                    const pipName = ev.pipeline?.name || "";
                    const badgeClass = getColorClass(pipName);

                    return (
                      <div key={ev.id} className={`relative group rounded-xl p-3 border shadow-sm transition-all hover:shadow-md ${badgeClass}`}>
                        <div className="font-bold text-sm mb-1 leading-tight">{ev.title}</div>
                        <div className="flex items-center gap-1 text-xs opacity-80 mt-2 font-medium">
                          <Clock className="w-3 h-3" /> {format(new Date(ev.startTime), 'h:mm a')}
                        </div>
                        {ev.contact && (
                          <div className="flex items-center gap-1 text-xs font-semibold mt-1">
                            <User className="w-3 h-3" /> {ev.contact.name || ev.contact.phone}
                          </div>
                        )}
                        {ev.location && (
                          <div className="flex items-start gap-1 text-[10px] font-bold mt-2 pt-2 border-t border-black/10 opacity-80">
                            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" /> 
                            <span className="leading-tight">{ev.location}</span>
                          </div>
                        )}
                        <button onClick={() => handleDelete(ev.id)} className="absolute top-2 right-2 text-slate-400/0 group-hover:text-red-500/80 hover:!text-red-600 transition-all rounded p-1 hover:bg-white/50">
                           <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                 })}
               </div>
             )
          })}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 p-6 text-white text-center rounded-t-3xl">
              <h2 className="text-2xl font-black tracking-tight">Programar Cita Taller/Instalador</h2>
            </div>
            <div className="p-6 space-y-5">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Título del Servicio</label>
                 <input autoFocus type="text" className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej. Lavado Sala Completa" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Día</label>
                   <input type="date" className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Hora</label>
                   <input type="time" className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
                 </div>
               </div>

               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Embudo / Categoría (Color)</label>
                 <select className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={newEvent.pipelineId} onChange={e => setNewEvent({...newEvent, pipelineId: e.target.value})}>
                   <option value="">(Sin color / Mixto)</option>
                   {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
               </div>
               
               <div className="pt-4 flex gap-3">
                 <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                 <button onClick={handleCreate} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all">Guardar Cita</button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
