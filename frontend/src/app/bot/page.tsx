"use client";

import { Bot, Save, Plus, Settings2, Trash2, Cpu } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";

export default function BotSettingsPage() {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddPipeline, setShowAddPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    const activeCid = localStorage.getItem('activeCompanyId');
    const qParams = activeCid ? `?companyId=${activeCid}` : '';
    
    axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox${qParams}`)
      .then((res: any) => {
         setPipelines(res.data.pipelines);
         if(res.data.pipelines.length > 0) {
            setCompanyId(res.data.pipelines[0].companyId);
         } else if (activeCid) {
            setCompanyId(activeCid);
         }
      })
      .catch((err: any) => console.error("Error fetching pipelines:", err));
  }, []);

  const handlePipelineChange = (index: number, field: string, value: string) => {
    const updated = [...pipelines];
    updated[index] = { ...updated[index], [field]: value };
    setPipelines(updated);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/inbox/bot/pipelines`, { pipelines });
      alert("✅ ¡Configuración guardada exitosamente!");
    } catch (e) {
      alert("❌ Error al guardar.");
    }
    setSaving(false);
    setSaving(false);
  };

  const createPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newPipelineName || !companyId) return alert("Falta nombre o companyId");
    try {
       const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/inbox/bot/pipelines/create`, {
          name: newPipelineName,
          companyId
       });
       setPipelines([...pipelines, res.data]);
       setShowAddPipeline(false);
       setNewPipelineName("");
    } catch(e) {
       alert("Error creando embudo.");
    }
  }

  const deletePipeline = async (id: string, name: string) => {
    if(!confirm(`¿Eliminar el embudo ${name}? Los contactos se moverán a "Sin Asignar".`)) return;
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/bot/pipelines/${id}`);
      setPipelines(pipelines.filter(p => p.id !== id));
    } catch(e) {
      alert("Error eliminando embudo.");
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Editor del Bot Inteligente <Bot className="h-8 w-8 text-indigo-500" />
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Configura la Inteligencia Heurística de OmniChat y cómo canaliza a tus clientes.</p>
        </div>
        <button 
          onClick={saveSettings}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          {saving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>

      <div className="space-y-6">
        
        {/* Embudos Enlazados (Dynamic) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
               <Cpu className="h-5 w-5 text-indigo-500" />
               <h2 className="text-lg font-bold text-slate-800">Cerebro Heurístico (Embudos)</h2>
             </div>
             <button onClick={() => setShowAddPipeline(true)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
               <Plus className="h-4 w-4" /> Agregar Embudo
             </button>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Escribe las <strong>Palabras Clave</strong> que el Bot debe escanear en los mensajes de los clientes para redirigirlos automáticamente a cada departamento sin usar menús. (Sepáralas con comas).
          </p>

          <div className="space-y-6">
            {pipelines.map((pipe, idx) => (
              <div key={pipe.id} className="bg-slate-50 p-5 rounded-xl border border-slate-200 group hover:border-indigo-300 transition-colors flex flex-col gap-4">
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 bg-indigo-100 text-indigo-700 font-black rounded-lg shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                     <h3 className="font-bold text-lg text-slate-800">{pipe.name}</h3>
                     <button onClick={() => deletePipeline(pipe.id, pipe.name)} className="text-slate-400 hover:text-red-500 transition-colors p-2" title="Eliminar Embudo">
                       <Trash2 className="h-4 w-4" />
                     </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">🔑 Palabras Clave</label>
                    <input 
                      type="text" 
                      value={pipe.keywords || ''}
                      onChange={(e) => handlePipelineChange(idx, 'keywords', e.target.value)}
                      placeholder="ej: fuga, tubo, agua..." 
                      className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">🤖 Respuesta Automática Inteligente</label>
                    <textarea 
                      rows={4}
                      value={pipe.autoReply || ''}
                      onChange={(e) => handlePipelineChange(idx, 'autoReply', e.target.value)}
                      placeholder="Mensaje a enviar al detectar coincidencia..." 
                      className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none shadow-inner"
                    />
                  </div>
                </div>

              </div>
            ))}
            
            {pipelines.length === 0 && (
              <div className="text-center py-10 opacity-50">
                <Bot className="h-10 w-10 mx-auto text-slate-400 mb-2 animate-pulse" />
                <p className="font-bold text-slate-500">Cargando cerebros...</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {showAddPipeline && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 relative">
              <button onClick={() => setShowAddPipeline(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <span className="font-bold text-xl">&times;</span>
              </button>
              <h2 className="text-xl font-black text-slate-800 mb-4">Nuevo Embudo</h2>
              <form onSubmit={createPipeline}>
                 <label className="block text-sm font-bold text-slate-700 mb-1">Nombre</label>
                 <input 
                   autoFocus
                   required
                   type="text" 
                   value={newPipelineName}
                   onChange={e => setNewPipelineName(e.target.value)}
                   className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 focus:border-indigo-500 outline-none mb-4"
                   placeholder="Ej: Internet Residencial"
                 />
                 <button type="submit" className="w-full bg-indigo-600 text-white font-black py-2.5 rounded-xl hover:bg-indigo-700 transition">
                   Crear Embudo
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

function GitMergeIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" x2="6" y1="9" y2="21" />
    </svg>
  )
}
