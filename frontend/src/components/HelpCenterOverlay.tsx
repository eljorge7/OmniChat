"use client";

import { useState } from "react";
import { HelpCircle, X, MessageCircle, Bot, Link as LinkIcon, Database, ChevronRight } from "lucide-react";

export default function HelpCenterOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-105 z-50 group flex items-center justify-center"
      >
         <HelpCircle className="w-6 h-6" />
         <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-3 transition-all duration-300 ease-in-out font-bold">
           Guía OmniChat
         </span>
      </button>
    );
  }

  const guides = [
    {
      icon: <Bot className="w-5 h-5 text-emerald-500" />,
      title: "1. Agente Inteligente IA",
      desc: "OmniChat usa Inteligencia Artificial para responder a tus clientes. Lee automáticamente tu Base de Datos."
    },
    {
      icon: <MessageCircle className="w-5 h-5 text-blue-500" />,
      title: "2. Bandeja de Entrada",
      desc: "Aquí puedes intervenir si la IA no logra resolver una duda. Simplemente escribe y tomarás el control manual."
    },
    {
      icon: <Database className="w-5 h-5 text-amber-500" />,
      title: "3. Embudo de WispHub",
      desc: "Las notificaciones automáticas de corte de WispHub aterrizan aquí y se envían escalonadamente para evitar bloqueos."
    },
    {
      icon: <LinkIcon className="w-5 h-5 text-indigo-500" />,
      title: "4. Reglas de Escalamiento",
      desc: "Configura qué palabras clave hacen que la IA te transfiera el chat en la ventana de Ajustes."
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end p-4 sm:p-6 mb-4 font-sans">
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-w-[22rem] bg-white h-full max-h-[85vh] self-end rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300">
        
        {/* Header */}
        <div className="bg-emerald-950 p-6 text-white shrink-0 relative">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white transition-colors bg-emerald-900 p-2 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-black tracking-tight">Guía Operativa</h2>
          </div>
          <p className="text-emerald-200/70 text-sm font-medium">Conceptos clave de tu Motor IA.</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
           <div className="space-y-2 p-2">
             {guides.map((g, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl hover:bg-white hover:shadow-md transition-all group cursor-pointer relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-emerald-500 transition-colors" />
                   <div className="flex gap-4 items-start pl-2">
                     <div className="bg-white p-2 rounded-xl shadow-sm ring-1 ring-slate-100 flex-shrink-0">
                       {g.icon}
                     </div>
                     <div>
                       <h3 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-emerald-700 transition-colors">{g.title}</h3>
                       <p className="text-xs text-slate-500 leading-relaxed font-medium">{g.desc}</p>
                     </div>
                   </div>
                </div>
             ))}
           </div>
           
           <div className="p-4 mt-2">
             <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                <h4 className="text-sm font-bold text-emerald-900 mb-2">¿Asistencia Estratégica?</h4>
                <p className="text-xs text-emerald-700 font-medium mb-4">La automatización B2B está siendo monitoreada de cerca.</p>
                <a href="mailto:soporte@radiotecpro.com" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl inline-flex items-center gap-2 transition-colors">
                  Contactar Ingeniería <ChevronRight className="w-4 h-4" />
                </a>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
