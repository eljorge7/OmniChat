"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Plus, MessageCircle } from "lucide-react";
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
  const { data: session } = useSession();
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  
  // Modal de Crear Cita
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ id: "", title: "", description: "", location: "", date: format(new Date(), "yyyy-MM-dd"), time: "10:00", pipelineId: "", assignedToId: "" });
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);

  // Modal de Detalles de Cita (Visualización y Borrado)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  useEffect(() => {
    const cid = localStorage.getItem("activeCompanyId") || "";
    setActiveCompanyId(cid);
    
    if (cid) {
      fetchEvents(cid);
      // Fetch Pipelines para color-coding
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox?companyId=${cid}`)
        .then(res => setPipelines(res.data.pipelines || []))
        .catch(console.error);
        
      // Fetch Técnicos/Usuarios
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/whatsapp/agents/${cid}`)
        .then(res => setTeamUsers(res.data || []))
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

    const payload = {
      title: newEvent.title,
      description: newEvent.description,
      location: newEvent.location,
      startTime: startObj.toISOString(),
      endTime: endObj.toISOString(),
      pipelineId: newEvent.pipelineId || null,
      assignedToId: newEvent.assignedToId || null
    };

    if (newEvent.id) {
       // UPDATE
       await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${activeCompanyId}/${newEvent.id}`, payload);
    } else {
       // CREATE
       await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${activeCompanyId}`, payload);
    }
    
    setIsModalOpen(false);
    fetchEvents(activeCompanyId);
  };

  const handleDelete = async (id: string) => {
       await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${activeCompanyId}/${id}`);
       setSelectedEvent(null);
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
             setNewEvent({ id: "", title: "", description: "", location: "", date: format(new Date(), "yyyy-MM-dd"), time: "10:00", pipelineId: "", assignedToId: (session?.user as any)?.id || "" });
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
            setNewEvent({ id: "", title: "", description: "", location: "", date: format(start, "yyyy-MM-dd"), time: format(start, "HH:mm"), pipelineId: "", assignedToId: (session?.user as any)?.id || "" });
            setIsModalOpen(true);
          }}
          onSelectEvent={(event) => {
            setSelectedEvent(event);
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
              <h2 className="text-2xl font-black tracking-tight">{newEvent.id ? 'Editar Cita' : 'Programar Cita'}</h2>
              <p className="text-indigo-100 mt-2 text-sm font-medium">{newEvent.id ? 'Modifica los datos del servicio.' : 'Asigna un técnico o cuadrilla al servicio.'}</p>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Ubicación (Dirección)</label>
                  <input type="text" className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Av. Siempre Viva 123" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Técnico Asignado</label>
                    <select className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={newEvent.assignedToId} onChange={e => setNewEvent({...newEvent, assignedToId: e.target.value})}>
                      <option value="">Sin asignar</option>
                      {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Embudo / Categoría</label>
                    <select className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={newEvent.pipelineId} onChange={e => setNewEvent({...newEvent, pipelineId: e.target.value})}>
                      <option value="">(Sin color / Mixto)</option>
                      {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
               
               <div className="pt-6 flex gap-4">
                 <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3.5 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">Cancelar</button>
                 <button onClick={handleCreate} className="flex-1 px-4 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5">Guardar Cita</button>
               </div>
            </div>
          </div>
        </div>
      )}
      {/* DETAILS MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: selectedEvent.pipeline?.name?.toLowerCase().includes('radiotec') ? '#3b82f6' : selectedEvent.pipeline?.name?.toLowerCase().includes('rent') ? '#10b981' : selectedEvent.pipeline?.name?.toLowerCase().includes('lavado') ? '#f97316' : '#6366f1' }}></div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedEvent.title}</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
                  <CalendarDays className="h-5 w-5 text-slate-400" />
                  {format(new Date(selectedEvent.startTime), "EEEE, d 'de' MMMM", { locale: es })}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {format(new Date(selectedEvent.startTime), "HH:mm")} - {format(new Date(selectedEvent.endTime), "HH:mm")}
                </div>
                {selectedEvent.pipeline && (
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    {selectedEvent.pipeline.name}
                  </div>
                )}
                {selectedEvent.location && (
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium mt-2">
                    <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
                {selectedEvent.assignedTo && (
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium mt-2">
                    <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span>Técnico: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedEvent.assignedTo.name}</span></span>
                  </div>
                )}
                {selectedEvent.description && (
                  <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium mt-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <svg className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                    <p>{selectedEvent.description}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
                <button onClick={() => {
                   setNewEvent({
                     id: selectedEvent.id,
                     title: selectedEvent.title,
                     description: selectedEvent.description || "",
                     location: selectedEvent.location || "",
                     date: format(new Date(selectedEvent.startTime), "yyyy-MM-dd"),
                     time: format(new Date(selectedEvent.startTime), "HH:mm"),
                     pipelineId: selectedEvent.pipelineId || "",
                     assignedToId: selectedEvent.assignedToId || ""
                   });
                   setSelectedEvent(null);
                   setIsModalOpen(true);
                }} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl flex items-center gap-2 transition-colors text-sm mr-auto">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Editar
                </button>
                {(() => {
                   const phoneMatch = selectedEvent.description?.match(/Tel(?:é|e)fono:\s*(\d+)/i);
                   const chatId = selectedEvent.contact?.id || (phoneMatch ? phoneMatch[1] : null);
                   if (!chatId) return null;
                   return (
                     <a href={`/inbox?chatId=${chatId}`} className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl flex items-center gap-2 transition-colors text-sm">
                       <MessageCircle className="w-4 h-4" />
                       Ver Chat
                     </a>
                   );
                })()}
                <button onClick={() => {
                  if (confirm(`¿Estás seguro de eliminar el evento "${selectedEvent.title}"? Esto lo borrará permanentemente de la agenda y de Google Calendar.`)) {
                    handleDelete(selectedEvent.id);
                  }
                }} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl flex items-center gap-2 transition-colors text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
