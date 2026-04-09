"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X, Search, Sparkles, MessageSquare, Database, PhoneCall, ChevronDown } from "lucide-react";

export default function HelpCenterOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const pathname = usePathname();

  if (pathname.includes('/login') || pathname === '/') {
    return null;
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-105 z-[90] group flex items-center justify-center animate-in zoom-in"
      >
         <HelpCircle className="w-6 h-6" />
         <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-3 transition-all duration-300 ease-in-out font-bold">
           Guía OmniChat
         </span>
      </button>
    );
  }

  const faqs = [
    {
      id: 1,
      icon: <Sparkles className="w-5 h-5 text-emerald-500" />,
      question: "¿La IA responde sola a todos?",
      answer: "Sí. Para eso fue diseñada. La Inteligencia Artificial lee tus propiedades, inquilinos y facturas, y atiende a cada prospecto según sea el caso. Tú no tienes que tocar tu celular para ventas iniciales."
    },
    {
      id: 2,
      icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
      question: "¿Cómo tomo yo el control del chat?",
      answer: "Entra a la Bandeja (Inbox) y busca a la persona. Simplemente escribe un mensaje en la caja de texto inferior y envíalo. Automáticamente, la IA se 'apagará' para ese cliente y pasará al estado de control manual liderado por ti."
    },
    {
      id: 3,
      icon: <Database className="w-5 h-5 text-amber-500" />,
      question: "¿Qué es el embudo de WispHub?",
      answer: "WispHub manda sus avisos de corte a este motor. Si enviáramos 300 mensajes de corte al mismo tiempo, WhatsApp te banearía el número. Por eso OmniChat los retiene y los envía 1 por 1 cada cierto tiempo (Sistema Anti-Spam)."
    },
    {
      id: 4,
      icon: <PhoneCall className="w-5 h-5 text-indigo-500" />,
      question: "¿Qué pasa si me piden hablar con un humano?",
      answer: "La IA tiene Reglas de Escalamiento. Si detecta la intención del cliente de evadir a la IA, o te reportan una emergencia técnica, el bot dejará de escribir y te mandará un 'Zumbido' o notificación de urgencia."
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end p-4 sm:p-6 font-sans">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-w-md bg-white h-full self-end rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-8 duration-300">
        
        {/* Header Elegante */}
        <div className="bg-emerald-950 p-8 text-white relative shrink-0">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white transition-colors bg-emerald-900 p-2 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="bg-emerald-600/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight mb-2">OmniChat HQ</h2>
          <p className="text-emerald-200/70 text-sm font-medium">Respuestas precisas sobre tu motor de IA y automatización.</p>
        </div>

        {/* Búsqueda (Visual only) */}
        <div className="px-6 -mt-5 relative z-10 shrink-0">
            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-slate-400 ml-2" />
                <input 
                  type="text" 
                  readOnly 
                  placeholder="¿Cómo apago el bot manual?" 
                  className="w-full text-sm font-medium focus:outline-none placeholder:text-slate-300 text-slate-700 bg-transparent"
                />
            </div>
        </div>

        {/* Content (Accordion) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {faqs.map((faq) => (
               <div 
                 key={faq.id} 
                 className={`border rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer ${
                    expandedId === faq.id ? 'border-emerald-200 bg-emerald-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                 }`}
                 onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
               >
                  <div className="p-4 flex items-center gap-4">
                     <div className="bg-white p-2 rounded-xl border border-slate-100 shrink-0">
                        {faq.icon}
                     </div>
                     <h3 className="font-bold text-slate-800 text-sm flex-1">{faq.question}</h3>
                     <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0 ${expandedId === faq.id ? 'rotate-180 text-emerald-500' : ''}`} />
                  </div>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out px-4 ${expandedId === faq.id ? 'max-h-48 pb-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                     <div className="pt-2 border-t border-emerald-100 pl-14">
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{faq.answer}</p>
                     </div>
                  </div>
               </div>
            ))}
            
            <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
                <h4 className="font-bold text-slate-800 mb-2">¿Pérdida de Conexión en Whatsapp?</h4>
                <p className="text-sm text-slate-500 mb-4 font-medium">Si la sesión colapsó, acude al escáner de red en la pestaña de Ajustes.</p>
                <a href="mailto:soporte@radiotecpro.com" className="bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold w-full inline-flex justify-center transition-colors shadow-lg active:scale-95">
                   Ingeniería de Sistemas 
                </a>
            </div>
        </div>

      </div>
    </div>
  );
}
