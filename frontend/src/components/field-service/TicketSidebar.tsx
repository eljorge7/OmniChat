"use client";

import React, { useState, useEffect } from 'react';
import { X, MapPin, Clock, User, Phone, MessageCircle, FileText, Camera, ChevronRight, Calendar, Maximize2, Check } from 'lucide-react';

import axios from 'axios';

interface TicketSidebarProps {
  ticket: any;
  onClose: () => void;
  fetchEvents?: () => void;
}

export default function TicketSidebar({ ticket, onClose, fetchEvents }: TicketSidebarProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEditingTechnician, setIsEditingTechnician] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (ticket) {
      setIsEditingTechnician(false);
      const cid = localStorage.getItem("activeCompanyId");
      if (cid) {
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/users/company/${cid}`)
          .then(res => setUsers(res.data))
          .catch(err => console.error("Error fetching users", err));
      }
    }
  }, [ticket]);

  const handleAssignTechnician = async (userId: string) => {
    if (!ticket || !ticket.id) return;
    setIsSaving(true);
    const cid = localStorage.getItem("activeCompanyId");
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${cid}/${ticket.id}`, { assignedToId: userId });
      setIsEditingTechnician(false);
      if (fetchEvents) fetchEvents();
    } catch (err) {
      console.error("Error assigning technician", err);
      alert("No se pudo asignar el técnico.");
    } finally {
      setIsSaving(false);
    }
  };

  const getFixedUrl = (url: string) => {
    if (!url) return '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return `${apiUrl}/api/uploads/${filename}`;
  };

  const handleDelete = async () => {
    if (!ticket || !ticket.originalEvent) return;
    const cid = localStorage.getItem("activeCompanyId");
    if (confirm(`¿Estás seguro de eliminar el ticket "${ticket.title}"?`)) {
      try {
        await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${cid}/${ticket.id}`);
        onClose();
        if (fetchEvents) fetchEvents();
      } catch (err) {
        console.error("Error deleting ticket", err);
        alert("No se pudo eliminar el ticket.");
      }
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-y-0 right-0 w-96 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out z-[60] flex flex-col
        ${ticket ? 'translate-x-0' : 'translate-x-full'}`}
      >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-950 shrink-0">
        <button 
          onClick={onClose}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Ticket #{ticket?.id?.padStart(4, '0')}
          </span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate w-full" title={ticket?.title}>
            {ticket?.title}
          </h2>
        </div>
      </div>

      {ticket && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Estatus */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Estatus Actual</label>
            <div className="flex items-center gap-2">
              <select 
                value={ticket.status}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  const cid = localStorage.getItem("activeCompanyId");
                  try {
                    await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${cid}/${ticket.id}`, { status: newStatus });
                    if (fetchEvents) fetchEvents();
                  } catch (err) {
                    console.error("Error updating status", err);
                    alert("No se pudo actualizar el estatus.");
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border-0 focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none
                ${ticket.status === 'SIN_ASIGNAR' ? 'bg-slate-100 text-slate-600' : 
                  ticket.status === 'PROGRAMADO' ? 'bg-indigo-100 text-indigo-700' :
                  ticket.status === 'EN_CAMINO' ? 'bg-yellow-100 text-yellow-700' :
                  ticket.status === 'TRABAJANDO' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'}`}
              >
                <option value="SIN_ASIGNAR">SIN ASIGNAR</option>
                <option value="PROGRAMADO">PROGRAMADO</option>
                <option value="EN_CAMINO">EN CAMINO</option>
                <option value="TRABAJANDO">TRABAJANDO</option>
                <option value="COMPLETADO">COMPLETADO</option>
              </select>
            </div>
          </div>

          {/* Información del Cliente */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-200 pb-2">Información del Cliente</h3>
            
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{ticket.client}</div>
                <div className="text-xs text-slate-500">Contacto Principal</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <div className="text-sm text-slate-700 dark:text-slate-300">{ticket.address}</div>
                <a href="#" className="text-xs text-indigo-600 hover:underline">Ver en el mapa</a>
              </div>
            </div>

            {/* Contact Buttons Removed Temporarily */}
          </div>

          {/* Asignación */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Técnico Asignado</label>
              {!isEditingTechnician && ticket.technician && (
                <button onClick={() => setIsEditingTechnician(true)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Cambiar</button>
              )}
            </div>

            {isEditingTechnician ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 px-2">Selecciona un técnico</span>
                  <button onClick={() => setIsEditingTechnician(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {users.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No hay técnicos disponibles</div>
                  ) : (
                    users.map(user => (
                      <button 
                        key={user.id}
                        disabled={isSaving}
                        onClick={() => handleAssignTechnician(user.id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                            {user.name.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{user.name}</div>
                            <div className="text-[10px] text-slate-500">{user.email}</div>
                          </div>
                        </div>
                        {ticket.originalEvent?.assignedToId === user.id && (
                          <Check className="w-4 h-4 text-indigo-600" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : ticket.technician ? (
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 p-3 rounded-xl shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setIsEditingTechnician(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {ticket.technician.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{ticket.technician}</div>
                    <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      Activo
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsEditingTechnician(true)} className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 p-4 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all group">
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center mb-2 transition-colors">
                  <User className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                </div>
                <span className="text-sm font-bold">Asignar Técnico</span>
              </button>
            )}
          </div>

          {/* Horario */}
          <div>
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Programación</label>
             <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
               <div className="flex items-center gap-2">
                 <Calendar className="w-4 h-4 text-slate-400" />
                 <span className="text-sm font-medium text-slate-700">Hoy</span>
               </div>
               <div className="w-px h-4 bg-slate-300"></div>
               <div className="flex items-center gap-2">
                 <Clock className="w-4 h-4 text-slate-400" />
                 <span className="text-sm font-medium text-slate-700">{ticket.startTime || 'Sin hora'}</span>
               </div>
             </div>
          </div>

          {/* Notas y Descripción */}
          {(ticket.originalEvent?.description || ticket.originalEvent?.comments) && (
            <div>
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Detalles y Notas</label>
               <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">
                  {ticket.originalEvent?.description || ticket.originalEvent?.comments}
               </div>
            </div>
          )}

          {/* Evidencias */}
          {ticket.status === 'COMPLETADO' && (
            <div>
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Reporte Final / Evidencias</label>
               <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                 
                 <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                   {ticket.originalEvent?.photoEvidence ? (
                     ticket.originalEvent.photoEvidence.split(',').filter(Boolean).map((url: string, idx: number) => {
                       const fixedUrl = getFixedUrl(url);
                       return (
                         <div key={idx} className="relative group cursor-pointer" onClick={() => setSelectedImage(fixedUrl)}>
                           <img src={fixedUrl} alt="Evidencia" className="w-20 h-20 object-cover rounded-lg shrink-0 border border-indigo-200 group-hover:opacity-80 transition-opacity" />
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                           </div>
                         </div>
                       )
                     })
                   ) : (
                     <span className="text-xs text-indigo-500">Sin evidencias fotográficas</span>
                   )}
                 </div>
               </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
             <button onClick={handleDelete} className="text-sm font-bold text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">
               Eliminar Ticket
             </button>
          </div>

        </div>
      )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Evidencia Ampliada" className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" />
          <button 
            className="absolute top-6 right-6 text-white hover:text-slate-300 bg-black/50 p-3 rounded-full transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <X className="w-8 h-8" />
          </button>
        </div>
      )}
    </>
  );
}
