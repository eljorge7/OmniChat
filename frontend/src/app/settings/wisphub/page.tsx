"use client";

import { useState, useEffect } from "react";
import { Link2, Copy, CheckCircle2, Server, Key, AlertTriangle } from "lucide-react";
import axios from "axios";
import { useSession } from "next-auth/react";

export default function WisphubSettingsPage() {
  const { data: session } = useSession();
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Intentar obtener de localStorage o de la base de datos
    const cid = localStorage.getItem('activeCompanyId');
    if (cid) {
      setActiveCompanyId(cid);
    } else {
      // Intentar obtener el maestro si no hay LocalStorage en este navegador
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/admin/companies`, { headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }})
        .then(sys => {
          if (sys.data[0]?.id) {
            setActiveCompanyId(sys.data[0].id);
          }
        }).catch(() => {});
    }
  }, []);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://api.radiotecpro.com"}/w/${activeCompanyId}`;

  const copyToClipboard = () => {
    if (!activeCompanyId) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="mb-8 border-b border-slate-100 pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Server className="h-8 w-8 text-sky-500" />
            Bypass de CRM WispHub
          </h1>
          <p className="text-slate-500 mt-3 font-medium text-lg">Centraliza tus avisos de cobro y cortes con OmniChat. Configura la Pasarela SMS de WispHub para no pagar recargos por el CRMInbox externo.</p>
        </div>

        <div className="space-y-8">
          {/* Alerta Inicial */}
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4">
            <div className="bg-amber-100 p-2 rounded-full mt-0.5">
               <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
               <h3 className="font-bold text-amber-900 text-lg">Requisito Previo</h3>
               <p className="text-amber-800/80 font-medium leading-relaxed">Debes tener el WhatsApp físico conectado y visible como <span className="font-bold">"Conectado Exitosamente"</span> en la pestaña de <span className="underline">Dispositivo Base</span>. Si lo tienes listo, procede a conectar el Puente (Webhook).</p>
            </div>
          </div>

          {/* Tarjeta de Conexion */}
          <div className="bg-slate-50 border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-inner relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-sky-400 to-indigo-600"></div>
            
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-2">
               <Link2 className="h-5 w-5 text-indigo-500" />
               Tu Enlace Puente (Webhook)
            </h3>
            <p className="text-slate-500 font-medium mb-6">Esta es la URL generada criptográficamente para tu sucursal. Copia este bloque de texto exactamente como está.</p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 overflow-x-auto font-mono text-sm font-bold text-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all flex items-center">
                 {activeCompanyId ? webhookUrl : "Cargando credenciales ID..."}
              </div>
              <button 
                onClick={copyToClipboard}
                disabled={!activeCompanyId}
                className={`flex border items-center justify-center gap-2 px-6 py-3 sm:py-0 rounded-xl font-bold transition-all disabled:opacity-50 min-w-[160px] ${copied ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 border-transparent shadow-lg shadow-indigo-200'}`}
              >
                {copied ? <><CheckCircle2 className="h-5 w-5" /> ¡Copiado!</> : <><Copy className="h-5 w-5" /> Copiar Link</>}
              </button>
            </div>
          </div>

          {/* Instrucciones Visuales */}
          <div className="grid md:grid-cols-3 gap-6 pt-4">
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-sky-200 hover:shadow-md transition-all">
                <div className="h-10 w-10 bg-slate-100 text-slate-500 font-black rounded-full flex items-center justify-center mb-4 text-lg">1</div>
                <h4 className="font-bold text-slate-800 text-lg mb-2">Abre tu WispHub</h4>
                <p className="text-slate-500 text-sm font-medium">Inicia sesión como administrador general. Ve al menú lateral "Ajustes" y busca la opción "Pasarela de SMS".</p>
             </div>
             
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-sky-200 hover:shadow-md transition-all">
                <div className="h-10 w-10 bg-slate-100 text-slate-500 font-black rounded-full flex items-center justify-center mb-4 text-lg">2</div>
                <h4 className="font-bold text-slate-800 text-lg mb-2">Activa Pasarela Personal</h4>
                <p className="text-slate-500 text-sm font-medium">En el tipo de pasarela selecciona "SMS/WhatsApp Personalizado" (Custom/URL) y asegúrate de elegir el método <b>POST</b> o <b>GET</b>.</p>
             </div>

             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all ring-1 ring-transparent hover:ring-indigo-100">
                <div className="h-10 w-10 bg-indigo-100 text-indigo-600 font-black rounded-full flex items-center justify-center mb-4 text-lg">3</div>
                <h4 className="font-bold text-slate-800 text-lg mb-2">Pega la URL de OmniChat</h4>
                <p className="text-slate-500 text-sm font-medium">Pega el link que copiaste arriba directamente en WispHub. Presiona Guardar y <b>Prueba de Mensaje</b>. ¡Listo!</p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
