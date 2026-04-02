"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Bot, Route, Zap, ArrowRight, Check } from "lucide-react";

export default function WelcomeTourModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localStorage.getItem("omnichat_tour_seen")) {
        setIsOpen(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleFinish = () => {
    localStorage.setItem("omnichat_tour_seen", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const slides = [
    {
      icon: <Bot className="w-16 h-16 text-emerald-500 mx-auto" />,
      title: "OmniChat IA",
      description: "Bienvenido al Motor de Comunicaciones. OmniChat aloja una IA entrenada que dominará tu WhatsApp 24/7 de forma 100% natural."
    },
    {
      icon: <MessageSquare className="w-16 h-16 text-blue-500 mx-auto" />,
      title: "Bandeja Unificada",
      description: "Intervén si lo deseas. Si tú escribes en la Bandeja Manual, el bot callará inmediatamente y dejará que tú cierres la venta."
    },
    {
      icon: <Route className="w-16 h-16 text-indigo-500 mx-auto" />,
      title: "Integración con Todo",
      description: "Este cerebro habla con RentControl y con WispHub en secreto. Cuando alguien te escribe, la IA ya sabe cuánto le debe y qué velocidad de internet tiene."
    },
    {
      icon: <Zap className="w-16 h-16 text-amber-500 mx-auto" />,
      title: "Reglas de Fuego",
      description: "Si alguien dice 'Soporte Técnico' o 'Hablar con humano', el bot disparará alertas a tu celular personal."
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-md animate-in fade-in duration-500" />
      
      <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl relative z-[101] animate-in zoom-in-95 duration-300 font-sans">
        {/* Progress Bar Header */}
        <div className="flex w-full h-1">
          {slides.map((_, i) => (
             <div key={i} className={`flex-1 transition-colors duration-500 ${i <= currentSlide ? 'bg-emerald-600' : 'bg-slate-100'}`} />
          ))}
        </div>

        <div className="p-8 pb-10 text-center relative overflow-hidden h-[340px] flex flex-col justify-center">
            {slides.map((s, idx) => (
                <div 
                   key={idx}
                   className={`absolute inset-0 flex flex-col items-center justify-center p-8 transition-all duration-500 ease-out ${
                       idx === currentSlide 
                         ? 'opacity-100 translate-x-0' 
                         : idx < currentSlide 
                           ? 'opacity-0 -translate-x-full'
                           : 'opacity-0 translate-x-full'
                   }`}
                >
                    <div className="bg-slate-50 w-28 h-28 rounded-full flex flex-col items-center justify-center mb-6 shadow-inner ring-1 ring-emerald-50">
                      {s.icon}
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-800 mb-4">{s.title}</h2>
                    <p className="text-slate-500 leading-relaxed font-medium px-4 text-[15px]">{s.description}</p>
                </div>
            ))}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
           <button 
             onClick={handleFinish} 
             className="text-slate-400 font-bold text-sm hover:text-slate-600 px-4 py-2"
           >
             Omitir
           </button>

           {currentSlide < slides.length - 1 ? (
             <button 
               onClick={() => setCurrentSlide(c => c+1)}
               className="bg-emerald-900 hover:bg-emerald-950 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
             >
                Siguiente <ArrowRight className="w-5 h-5" />
             </button>
           ) : (
             <button 
               onClick={handleFinish}
               className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
             >
                Comenzar <Check className="w-5 h-5" />
             </button>
           )}
        </div>
      </div>
    </div>
  );
}
