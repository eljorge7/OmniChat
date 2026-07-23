"use client";

import React, { useState } from 'react';
import { Clock, MapPin, Navigation, User, FileText, CheckCircle2 } from 'lucide-react';
import TicketSidebar from './TicketSidebar';

type TicketStatus = 'SIN_ASIGNAR' | 'PROGRAMADO' | 'EN_CAMINO' | 'TRABAJANDO' | 'COMPLETADO';

interface Ticket {
  id: string;
  title: string;
  client: string;
  address: string;
  status: TicketStatus;
  technician?: string;
  startTime?: string;
}

const MOCK_TICKETS: Ticket[] = [
  { id: '1', title: 'Mantenimiento Preventivo', client: 'Empresa Alpha', address: 'Av. Reforma 222', status: 'PROGRAMADO', technician: 'Juan Técnico', startTime: '10:00 AM' },
  { id: '2', title: 'Instalación de Fibra Óptica', client: 'Corporativo Beta', address: 'Insurgentes Sur 105', status: 'EN_CAMINO', technician: 'Juan Técnico', startTime: '15:00 PM' },
  { id: '3', title: 'Reparación de Router', client: 'Cafetería El Grano', address: 'Roma Norte 45', status: 'SIN_ASIGNAR' },
  { id: '4', title: 'Revisión de Nodos', client: 'Torre Mayor', address: 'Reforma 505', status: 'TRABAJANDO', technician: 'Pedro López' },
  { id: '5', title: 'Cambio de Switch', client: 'Plaza Delta', address: 'Cuauhtémoc 462', status: 'COMPLETADO', technician: 'María Gómez' },
];

const COLUMNS: { id: TicketStatus; label: string; color: string; border: string }[] = [
  { id: 'SIN_ASIGNAR', label: 'Sin Asignar', color: 'bg-slate-100', border: 'border-slate-300' },
  { id: 'PROGRAMADO', label: 'Programado', color: 'bg-indigo-50', border: 'border-indigo-300' },
  { id: 'EN_CAMINO', label: 'En Camino', color: 'bg-yellow-50', border: 'border-yellow-400' },
  { id: 'TRABAJANDO', label: 'Trabajando', color: 'bg-blue-50', border: 'border-blue-400' },
  { id: 'COMPLETADO', label: 'Completado', color: 'bg-green-50', border: 'border-green-400' },
];

export default function KanbanBoard() {
  const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-900">
      <div className="flex-1 overflow-x-auto p-6 flex gap-6">
        {COLUMNS.map(col => {
          const colTickets = tickets.filter(t => t.status === col.id);
          
          return (
            <div key={col.id} className={`flex-shrink-0 w-80 flex flex-col rounded-xl border ${col.border} ${col.color} bg-opacity-50 dark:bg-opacity-10`}>
              {/* Column Header */}
              <div className="p-4 border-b border-inherit bg-white bg-opacity-50 dark:bg-slate-800 rounded-t-xl flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide">{col.label}</h3>
                <span className="bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                  {colTickets.length}
                </span>
              </div>
              
              {/* Column Body */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {colTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => setSelectedTicket(ticket)}
                    className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-slate-400">#{ticket.id.padStart(4, '0')}</span>
                      {ticket.startTime && (
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {ticket.startTime}
                        </span>
                      )}
                    </div>
                    
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                      {ticket.title}
                    </h4>
                    
                    <div className="text-sm text-slate-500 mb-3">{ticket.client}</div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2 text-xs text-slate-500">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{ticket.address}</span>
                      </div>
                      
                      {ticket.technician ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-md mt-2">
                          <User className="w-3.5 h-3.5" />
                          <span className="truncate">{ticket.technician}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1.5 rounded-md mt-2 border border-slate-200 border-dashed">
                          <User className="w-3.5 h-3.5" />
                          <span>Sin Técnico Asignado</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-out Sidebar */}
      <TicketSidebar 
        ticket={selectedTicket} 
        onClose={() => setSelectedTicket(null)} 
      />
    </div>
  );
}
