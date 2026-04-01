"use client";

import { useState, useEffect } from "react";
import { Megaphone, SendHorizontal, Users, Tag, AlertTriangle, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import axios from "axios";

export default function BroadcastStudioPage() {
  const [message, setMessage] = useState("Hola {name}, tenemos una promoción especial para ti.\\n\\n¡Saludos!");
  const [audience, setAudience] = useState("all");
  const [selectedTag, setSelectedTag] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, tagged: 0 });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/contacts/all`);
      const contacts = res.data;
      
      const allTags = Array.from(new Set(contacts.flatMap((c: any) => c.tags || []))) as string[];
      setTags(allTags);
      
      setStats({
        total: contacts.length,
        tagged: contacts.filter((c: any) => c.tags && c.tags.length > 0).length
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLaunch = async () => {
    if (!message.trim()) return alert("El mensaje no puede estar vacío");
    if (audience === 'tag' && !selectedTag) return alert("Debes seleccionar una etiqueta objetivo.");
    
    if(!confirm("⚠️ ATENCIÓN: Estás a punto de enviar una Difusión Masiva.\\n\\nEl sistema enviará los mensajes con un retraso dinámico de 3 a 8 segundos entre cada uno para evitar bloqueos por parte de Meta.\\n\\n¿Deseas iniciar la campaña?")) return;

    setSending(true);
    try {
      // Get logical company bypass (assuming local demo scenario)
      const sys = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/admin/companies`, { headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }});
      const companyId = sys.data[0]?.id;
      if(!companyId) return alert("Error de Sincronización SaaS.");

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/broadcast`, {
        companyId,
        message,
        audience,
        tag: selectedTag
      });
      
      alert("🚀 ¡Campaña Encolada Exitosamente!\\n\\nPuedes cerrar esta ventana. Los mensajes se enviarán automáticamente en 2do plano.");
    } catch (e) {
      console.error(e);
      alert("Error iniciando la difusión.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pt-6 px-6">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-indigo-600" />
            Embudos de Difusión Masiva
          </h1>
          <p className="text-slate-500 font-medium mt-1">Envía campañas de marketing hiper-personalizadas de forma segura.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Editor (Izquierda) */}
        <div className="md:col-span-2 space-y-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
               <FileText className="h-5 w-5 text-slate-400" /> Redactor de Campaña
             </h2>
             
             <div className="mb-4">
               <label className="block text-sm font-bold text-slate-700 mb-2">Cuerpo del Mensaje</label>
               <textarea 
                 value={message}
                 onChange={e => setMessage(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-48 font-medium text-slate-700"
               />
               <p className="text-xs text-slate-500 mt-2 font-medium">Usa la variable <code className="bg-slate-100 text-indigo-600 px-1 rounded">&#123;name&#125;</code> para inyectar dinámicamente el nombre de la persona extraído del CSV.</p>
             </div>

             <div className="border-t border-slate-100 pt-5 mt-5">
               <label className="block text-sm font-bold text-slate-700 mb-3">Público Objetivo (Segmentación)</label>
               <div className="flex gap-4">
                 <button 
                  onClick={() => setAudience('all')}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${audience === 'all' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}
                 >
                   <Users className="h-5 w-5" /> Todos ({stats.total})
                 </button>
                 <button 
                  onClick={() => setAudience('tag')}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${audience === 'tag' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}
                 >
                   <Tag className="h-5 w-5" /> Por Etiqueta
                 </button>
               </div>
             </div>

             {audience === 'tag' && (
               <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <label className="block text-sm font-bold text-amber-900 mb-2">Selecciona la Etiqueta (Tag)</label>
                  {tags.length === 0 ? (
                    <p className="text-xs text-amber-700 font-medium">No has asignado ninguna etiqueta en este Tenant. Ve a la Bandeja Compartida y clasifica algunos leads primero.</p>
                  ) : (
                    <select 
                      value={selectedTag} 
                      onChange={e => setSelectedTag(e.target.value)}
                      className="w-full bg-white border border-amber-200 text-amber-900 rounded-lg p-2.5 text-sm font-bold outline-none cursor-pointer"
                    >
                      <option value="" disabled>Seleccionar Etiqueta...</option>
                      {tags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
               </div>
             )}
           </div>

           {/* Motor Anti-Spam (Seguridad) */}
           <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex gap-4 items-start">
             <div className="bg-emerald-100 p-3 rounded-full shrink-0">
               <ShieldCheck className="h-6 w-6 text-emerald-600" />
             </div>
             <div>
               <h3 className="font-bold text-emerald-900">Motor Throttling Activado (Protección Meta)</h3>
               <p className="text-sm font-medium text-emerald-700 mt-1">Tu campaña no ejecutará un ataque DDoS contra la API de WhatsApp. El servidor intercalará deliberadamente pausas aleatorias de 3 a 8 segundos entre cada mensaje, simulando un tecleo humano y salvaguardando tu número de reportes algorítmicos.</p>
             </div>
           </div>
        </div>

        {/* Vista Previa y Disparo (Derecha) */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
             {/* Mock de Celular (Estética) */}
             <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -z-10" />
             <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center justify-between">
               Vista Previa 
               <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500">iOS/Android</span>
             </h2>

             {/* Burbuja de Mensaje */}
             <div className="bg-[#DCF8C6] p-4 rounded-2xl rounded-tr-sm shadow-sm relative text-[13px] leading-relaxed text-slate-800 whitespace-pre-wrap border border-[#c1e6a6]">
               {message.replace(/{name}/g, 'Jorge R.') || 'Tu mensaje aparecerá aquí...'}
               <span className="block text-right text-[10px] text-emerald-600/70 font-bold mt-2">10:42 AM ✓✓</span>
             </div>

             <div className="mt-8">
               <button 
                 onClick={handleLaunch}
                 disabled={sending || (audience === 'tag' && !selectedTag)}
                 className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-[0_8px_30px_rgb(79,70,229,0.3)] transition-all flex flex-col items-center justify-center gap-1 group"
               >
                 <span className="flex items-center gap-2 text-lg">
                   {sending ? 'Analizando...' : 'Lanzar Campaña'} <SendHorizontal className={`h-5 w-5 ${sending ? '' : 'group-hover:translate-x-1 transition-transform'}`} />
                 </span>
                 <span className="text-[10px] font-medium text-indigo-200">El proceso se enviará a Task Queue (2do plano)</span>
               </button>
             </div>
           </div>

           <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 border-dashed flex gap-3">
             <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
             <p className="text-sm font-medium text-amber-800">Si un contacto te reporta como "Spam" o te bloquea, tu calificación de calidad bajará en WhatsApp. Utiliza la Difusión con precaución y aporta valor.</p>
           </div>
        </div>
      </div>

    </div>
  );
}
