"use client";

import { BrainCircuit, Save, Key, FileText, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";

export default function AiProfilePage() {
  const { data: session } = useSession();
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiPrompt, setOpenAiPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const activeCid = localStorage.getItem('activeCompanyId');
    const qParams = activeCid ? `?companyId=${activeCid}` : '';
    axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/bot/config${qParams}`)
      .then(res => {
         setOpenAiKey(res.data.openAiKey || "");
         setOpenAiPrompt(res.data.openAiPrompt || "");
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const activeCid = localStorage.getItem('activeCompanyId');
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/inbox/bot/config`, {
        companyId: activeCid,
        openAiKey,
        openAiPrompt
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Error al guardar AI config:", e);
      alert("Hubo un error al guardar la configuración.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-slate-500 font-bold">Cargando perfil IA...</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <BrainCircuit className="h-7 w-7 text-indigo-600" />
          Perfil de Inteligencia Artificial (Cerebro)
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          Configura la identidad, conocimientos y reglas de negocio con las que ChatGPT responderá a tus clientes cuando actives el Piloto Automático.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8 flex gap-4">
         <Lightbulb className="h-6 w-6 text-amber-500 shrink-0" />
         <div>
            <h3 className="font-bold text-amber-900 mb-1">¿Cómo entrena esto a mi bot?</h3>
            <p className="text-sm text-amber-800/80">
              Absolutamente <strong>TODO</strong> lo que escribas en el "Prompt de Instrucciones" será la Biblia de tu bot. Puedes pegar aquí tu catálogo de precios, tu horario de atención, o incluso instruirlo de que nunca dé descuentos. Si la respuesta no está en el texto de abajo, el bot improvisará con sentido común o pedirá ayuda a un humano.
            </p>
         </div>
      </div>

      <div className="space-y-6">
        {/* OpenAI API Key */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-black text-slate-800 mb-4">
            <Key className="h-4 w-4 text-slate-400" />
            Clave de Conexión OpenAI (API Key)
          </label>
          <input 
            type="password" 
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
            placeholder="sk-proj-..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition"
          />
          <p className="text-xs text-slate-400 mt-2">
            Obtén tu clave secreta desde el panel de <a href="https://platform.openai.com/api-keys" target="_blank" className="text-indigo-500 hover:underline">OpenAI Developers</a>. Requiere saldo en la plataforma.
          </p>
        </div>

        {/* System Prompt (Knowledge Base) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-black text-slate-800 mb-4">
            <FileText className="h-4 w-4 text-slate-400" />
            Libro de Instrucciones (System Prompt RAG)
          </label>
          <textarea 
            value={openAiPrompt}
            onChange={(e) => setOpenAiPrompt(e.target.value)}
            placeholder='Ej: "Eres Pedro, el especialista de ventas de RadioTec. Vendes 2 planes de internet: Básico por $300 y Familiar por $500..."'
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition h-96 resize-y"
          />
          <p className="text-xs text-slate-400 mt-3 font-medium flex gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" /> 
            Pro Tip: Entre más detalles incluyas sobre tus procesos de venta, objeciones y cierres, más ventas logrará concretar la IA.
          </p>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 shadow-sm transition"
          >
            {isSaving ? (
              <span>Guardando...</span>
            ) : saved ? (
              <><CheckCircle2 className="h-5 w-5" /> Guardado Exitoso</>
            ) : (
              <><Save className="h-5 w-5" /> Guardar Perfil IA</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
