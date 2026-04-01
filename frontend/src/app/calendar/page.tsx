"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Plus } from "lucide-react";
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { es }
});

export default function CalendarPage() {
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  
  // Modal de Crear Cita
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", date: format(new Date(), "yyyy-MM-dd"), time: "10:00", pipelineId: "" });
  const [pipelines, setPipelines] = useState<any[]>([]);

  useEffect(() => {
    const cid = localStorage.getItem("activeCompanyId") || "";
    setActiveCompanyId(cid);
    
    if (cid) {
      fetchEvents(cid);
      // Fetch Pipelines para color-coding
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox?companyId=${cid}`)
        .then(res => setPipelines(res.data.pipelines || []))
        .catch(console.error);
    }
  }, []);

  const fetchEvents = (cid: string) => {
    // Obtenemos todos los eventos (el Backend omitirá el filtro start/end si no se mandan)
    axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${cid}`)
      .then(res => setEvents(res.data))
      .catch(console.error);
  };

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
    fetchEvents(activeCompanyId);
  };

  const handleDelete = async (id: string) => {
       await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${activeCompanyId}/${id}`);
       fetchEvents(activeCompanyId);
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
          <p className="text-slate-500 mt-2 font-medium">Control unificado dinámico interactivo de operaciones (Mes, Semana, Día).</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => {
             setNewEvent({ title: "", description: "", date: format(new Date(), "yyyy-MM-dd"), time: "10:00", pipelineId: "" });
             setIsModalOpen(true);
          }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5">
            <Plus className="h-5 w-5" /> Nueva Cita
          </button>
        </div>
      </div>

      {/* BIG CALENDAR WRAPPER */}
      <div className="flex-1 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-white/50 dark:border-slate-800/50 overflow-hidden flex flex-col min-h-[650px]
       [&_.rbc-toolbar_button]:font-medium [&_.rbc-toolbar_button]:rounded-xl [&_.rbc-toolbar_button.rbc-active]:bg-gradient-to-br [&_.rbc-toolbar_button.rbc-active]:from-indigo-500 [&_.rbc-toolbar_button.rbc-active]:to-indigo-600 [&_.rbc-toolbar_button.rbc-active]:text-white [&_.rbc-toolbar_button.rbc-active]:shadow-lg [&_.rbc-toolbar_button.rbc-active]:shadow-indigo-500/30 [&_.rbc-toolbar_button.rbc-active]:border-transparent [&_.rbc-event]:shadow-sm p-8
      ">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor={(event) => new Date(event.startTime)}
          endAccessor={(event) => new Date(event.endTime)}
          culture="es"
          messages={{
             next: "Siguiente", previous: "Anterior", today: "Hoy", month: "Mes", week: "Semana", day: "Día", agenda: "Agenda"
          }}
          selectable
          onSelectSlot={({ start }) => {
            setNewEvent({ ...newEvent, date: format(start, "yyyy-MM-dd"), time: format(start, "HH:mm") });
            setIsModalOpen(true);
          }}
          onSelectEvent={(event) => {
            if(confirm(`¿Eliminar la cita "${event.title}"?`)) {
               handleDelete(event.id);
            }
          }}
          eventPropGetter={(event) => {
             const pipName = event.pipeline?.name || "";
             const c = pipName.toLowerCase();
             let backgroundColor = '#6366f1'; // indigo-500 default
             if (c.includes('radiotec')) backgroundColor = '#3b82f6'; // blue-500
             if (c.includes('rent')) backgroundColor = '#10b981'; // emerald-500
             if (c.includes('lavado')) backgroundColor = '#f97316'; // orange-500
             return { style: { backgroundColor, borderRadius: '6px', border: 'none', padding: '4px', fontWeight: 'bold' } };
          }}
          style={{ height: '100%' }}
        />
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-8 text-white text-center">
              <h2 className="text-2xl font-black tracking-tight">Programar Cita</h2>
              <p className="text-indigo-100 mt-2 text-sm font-medium">Asigna un técnico o cuadrilla al servicio.</p>
            </div>
            <div className="p-8 space-y-6">
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
               
               <div className="pt-6 flex gap-4">
                 <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3.5 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">Cancelar</button>
                 <button onClick={handleCreate} className="flex-1 px-4 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5">Guardar Cita</button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
