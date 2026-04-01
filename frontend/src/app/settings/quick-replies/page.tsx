"use client";

import { useState, useEffect } from "react";
import { Zap, Command, Trash2, Edit3, Plus, TerminalSquare, AlertCircle } from "lucide-react";
import axios from "axios";

interface QuickReply {
  id: string;
  shortcut: string;
  content: string;
}

export default function QuickRepliesSettings() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Assuming monolithic local demo approach to bypass Auth contexts for now
      const sys = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/v1/admin/companies`, { headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }});
      const compId = sys.data[0]?.id;
      if (!compId) return;

      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/quick-replies/${compId}`);
      setReplies(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!shortcut || !content) return;

    setIsSaving(true);
    try {
      const sys = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/v1/admin/companies`, { headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }});
      const compId = sys.data[0]?.id;

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/inbox/quick-replies`, {
        companyId: compId,
        shortcut,
        content
      });

      setShortcut("");
      setContent("");
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Error guardando atajo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("¿Eliminar este atajo?")) return;
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/quick-replies/${id}`);
      setReplies(replies.filter(r => r.id !== id));
    } catch (e) {
      alert("Error eliminando.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-6">
        
        <div className="flex items-center gap-4 mb-8">
           <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
             <Zap className="h-8 w-8" />
           </div>
           <div>
             <h1 className="text-3xl font-black text-slate-800 tracking-tight">Canned Hooks (Respuestas Rápidas)</h1>
             <p className="text-slate-500 font-medium">Automatiza bloques de texto largos configurando atajos personalizados de teclado para tu equipo de ventas.</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           
           {/* Formulario */}
           <div className="md:col-span-1">
             <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
               <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-indigo-500" /> Nuevo Atajo</h2>
               
               <div className="space-y-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Comando Slash (/)</label>
                   <div className="relative">
                     <TerminalSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                     <input 
                       type="text" 
                       value={shortcut}
                       onChange={e => setShortcut(e.target.value.replace(/\\s/g, '').toLowerCase())}
                       placeholder="ej. /cuenta" 
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                     />
                   </div>
                 </div>

                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cuerpo del Mensaje Largo</label>
                   <textarea 
                     value={content}
                     onChange={e => setContent(e.target.value)}
                     placeholder="Escribe el texto enorme que se auto-completará..." 
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32"
                   />
                 </div>

                 <button 
                  type="submit" 
                  disabled={isSaving || !shortcut || !content}
                  className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition-all"
                 >
                   {isSaving ? 'Guardando...' : 'Crear Comando'}
                 </button>
               </div>
             </form>
             
             <div className="mt-4 bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-sm text-blue-800">
               <AlertCircle className="h-5 w-5 shrink-0" />
               <p>Para usar tus atajos, ve a la <b>Bandeja de Chats</b> y teclea <code className="bg-blue-200 px-1 rounded font-bold">/</code> en el cuadro de texto. Verás un panel desplegarse en vivo.</p>
             </div>
           </div>

           {/* Lista de Atajos */}
           <div className="md:col-span-2 space-y-4">
             {loading ? (
                <div className="text-center p-10 text-slate-400 font-bold">Cargando biblioteca...</div>
             ) : replies.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
                   <Command className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                   <p className="text-slate-500 font-bold">No hay Respuestas Rápidas registradas.</p>
                   <p className="text-slate-400 text-sm mt-1">Crea tu primer comando a la izquierda para ahorrar tiempo de escritura.</p>
                </div>
             ) : (
                replies.map(r => (
                  <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4 hover:border-indigo-200 transition-colors group">
                    <div className="bg-slate-100 p-2.5 rounded-xl shrink-0">
                      <Command className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                          {r.shortcut}
                        </span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm whitespace-pre-wrap mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                        {r.content}
                      </p>
                    </div>
                  </div>
                ))
             )}
           </div>

        </div>
      </div>
  );
}
