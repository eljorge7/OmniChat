"use client";

import React from 'react';
import { X, MapPin, Clock, User, Phone, MessageCircle, FileText, Camera, ChevronRight, Calendar } from 'lucide-react';

interface TicketSidebarProps {
  ticket: any;
  onClose: () => void;
}

export default function TicketSidebar({ ticket, onClose }: TicketSidebarProps) {
  return (
    <div 
      className={`fixed inset-y-0 right-0 w-96 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out z-50 flex flex-col
      ${ticket ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 shrink-0">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Ticket #{ticket?.id?.padStart(4, '0')}
          </span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate w-64" title={ticket?.title}>
            {ticket?.title}
          </h2>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {ticket && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Estatus */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Estatus Actual</label>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide
                ${ticket.status === 'SIN_ASIGNAR' ? 'bg-slate-100 text-slate-600' : 
                  ticket.status === 'PROGRAMADO' ? 'bg-indigo-100 text-indigo-700' :
                  ticket.status === 'EN_CAMINO' ? 'bg-yellow-100 text-yellow-700' :
                  ticket.status === 'TRABAJANDO' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'}`}
              >
                {ticket.status.replace('_', ' ')}
              </div>
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

            <div className="flex items-center gap-3 pt-2">
              <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <Phone className="w-4 h-4" /> Llamar
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] py-2 rounded-lg text-sm font-medium text-white transition-colors">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </div>

          {/* Asignación */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Técnico Asignado</label>
            {ticket.technician ? (
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 p-3 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {ticket.technician.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{ticket.technician}</div>
                    <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      Activo ahora
                    </div>
                  </div>
                </div>
                <button className="text-xs text-indigo-600 font-medium hover:underline">Cambiar</button>
              </div>
            ) : (
              <button className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 p-4 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                <User className="w-6 h-6 mb-2" />
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

          {/* Evidencias (Mock) */}
          {ticket.status === 'COMPLETADO' && (
            <div>
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Reporte Final</label>
               <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                 <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2 text-indigo-700">
                     <FileText className="w-5 h-5" />
                     <span className="text-sm font-bold">Ticket de Servicio.pdf</span>
                   </div>
                   <button className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md font-medium hover:bg-indigo-700">
                     Ver PDF
                   </button>
                 </div>
                 
                 <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                   <div className="w-20 h-20 bg-indigo-200 rounded-lg shrink-0 flex items-center justify-center text-indigo-400">
                     <Camera className="w-6 h-6" />
                   </div>
                   <div className="w-20 h-20 bg-indigo-200 rounded-lg shrink-0 flex items-center justify-center text-indigo-400">
                     <Camera className="w-6 h-6" />
                   </div>
                 </div>
               </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
