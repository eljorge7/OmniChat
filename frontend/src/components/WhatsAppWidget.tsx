"use client";

import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Bot, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { sendSupportWebhook } from "@/app/actions/support.actions";

export default function WhatsAppWidget() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const user = session?.user as any;
    if (user && user.phone && !phone) {
      setPhone(user.phone);
    }
  }, [session, phone]);

  if (pathname === '/login' || pathname === '/registro' || pathname === '/' || pathname.startsWith('/quote') || pathname.startsWith('/ticket')) {
    return null;
  }

  if (!session?.user) return null;

  const user = session.user as any;
  const roleNameMap: Record<string, string> = {
    'ADMIN': 'Super Admin',
    'MANAGER': 'Manager Operativo',
    'OWNER': 'Propietario',
    'TENANT': 'Inquilino',
    'admin': 'Super Admin'
  };
  const displayRole = roleNameMap[user.role] || 'Usuario';
  const firstName = user.name?.split(' ')[0] || '';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !phone.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await sendSupportWebhook({
        name: `${user.name} (${displayRole})`,
        phone: phone,
        interest: `Soporte OmniChat: ${message}`
      });
      
      if (!result.success) {
         throw new Error(result.error);
      }
      
      setIsSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
        setMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error enviando ticket:", error);
      // Fallback
      const waUrl = `https://wa.me/5211234567890?text=${encodeURIComponent("*Soporte MAJIA OS:*\n" + message)}`;
      window.open(waUrl, '_blank');
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-[90] font-sans">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#25D366] hover:bg-[#1ebe57] text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 flex items-center justify-center animate-in zoom-in group relative"
        >
          <MessageCircle className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full animate-pulse border-2 border-white"></span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-3 transition-all duration-300 ease-in-out font-bold">
            Soporte Central
          </span>
        </button>
      )}

      {isOpen && (
        <div className="bg-white w-[340px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-8 duration-300 flex flex-col">
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Soporte MAJIA OS</h4>
                <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sistema Inteligente
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {isSuccess ? (
            <div className="p-8 text-center bg-slate-50 flex-1 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
              <h3 className="font-black text-slate-800 text-lg mb-2">¡Reporte Enviado!</h3>
              <p className="text-sm text-slate-600 font-medium">
                Enviamos tu reporte al Centro de Comando. Recibirás una notificación por WhatsApp al {phone} en breve.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-slate-50 flex-1 min-h-[120px] max-h-[300px] overflow-y-auto space-y-4">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0 flex items-center justify-center border border-slate-300">
                    <Bot className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 text-sm text-slate-700">
                    <p>Hola <strong>{firstName}</strong> ({displayRole}).</p>
                    <p className="mt-1">Nuestro motor canalizará tu reporte internamente y te responderemos a tu teléfono con la solución. ¿En qué falló el sistema?</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex flex-col gap-3 shrink-0">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Tu Celular (WhatsApp)</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 642 123 4567"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe el fallo..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!message.trim() || !phone.trim() || isSubmitting}
                    className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
