"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { Smartphone, CheckCircle2, Loader2, RefreshCw, AlertTriangle, PlayCircle } from "lucide-react";

export default function WhatsappSettingsPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("INITIALIZING");
  const [qrCode, setQrCode] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const checkStatus = async (companyId: string) => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/qr/${companyId}`);
      setStatus(res.data.status);
      setQrCode(res.data.qr);
    } catch (e) {
      console.error("Error fetching QR status");
    }
  };

  const fetchProfile = async () => {
    try {
      const companyId = (session?.user as any)?.companyId;
      if (companyId) {
         const compRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/companies/${companyId}/public`);
         if (compRes.data.whatsappNumber) setWhatsappNumber(compRes.data.whatsappNumber);
      }
    } catch (e) {
      console.error("Error fetching profile", e);
    }
  };

  const saveWhatsappNumber = async () => {
    setIsSaving(true);
    try {
      const email = session?.user?.email;
      if (!email) throw new Error("No email found in session");
      
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/companies/me`, 
        { email, whatsappNumber }
      );
      alert('Número oficial guardado correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error guardando el número');
    }
    setIsSaving(false);
  };

  const handleRestart = async () => {
    const companyId = (session?.user as any)?.companyId;
    if (!companyId) return;
    
    if (!confirm("¿Seguro que deseas forzar el reinicio? Esto borrará la sesión actual de WhatsApp y tendrás que volver a escanear el QR.")) return;
    setStatus("INITIALIZING");
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/qr/reset/${companyId}`);
    } catch (e) {
      alert("Error reiniciando sesión");
    }
  };

  useEffect(() => {
    if (session?.user) {
      const companyId = (session.user as any).companyId;
      if (!companyId) return;
      
      checkStatus(companyId);
      const interval = setInterval(() => checkStatus(companyId), 3000);
      return () => clearInterval(interval);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <Smartphone className="h-8 w-8 text-indigo-600" />
              Dispositivo Base
            </h1>
            <p className="text-slate-500 mt-3 font-medium text-lg">Gestiona la conexión física del número de esta Franquicia.</p>
          </div>
          <button onClick={checkStatus} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm">
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center p-16 bg-slate-50/50 rounded-3xl border border-slate-100 relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 via-indigo-500 to-slate-200"></div>

          {status === 'READY' ? (
            <div className="text-center animate-in zoom-in duration-500">
              <div className="mx-auto w-28 h-28 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 shadow-inner ring-4 ring-emerald-50">
                <CheckCircle2 className="h-14 w-14" />
              </div>
              <h2 className="text-3xl font-black text-slate-800">¡Conectado Exitosamente!</h2>
              <p className="text-slate-500 mt-4 max-w-md mx-auto font-medium text-lg">El Motor "OmniChat CRM" está enrutando y operando el módulo de WhatsApp de tu empresa de forma autónoma.</p>
            </div>
          ) : status === 'AWAITING_QR' && qrCode ? (
            <div className="text-center animate-in zoom-in duration-500">
              <h2 className="text-2xl font-black text-slate-800 mb-6">Escanea para enlazar</h2>
              <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 inline-block mb-8">
                <QRCodeSVG value={qrCode} size={300} className="rounded-xl" />
              </div>
              <p className="text-slate-600 font-bold text-lg">Abre WhatsApp en tu celular empresarial &gt; Dispositivos vinculados &gt; Vincular dispositivo</p>
            </div>
          ) : status === 'ERROR' ? (
            <div className="text-center flex flex-col items-center animate-in zoom-in duration-500">
              <div className="mx-auto w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-red-50">
                <AlertTriangle className="h-12 w-12" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-4">Error de Sincronización</h2>
              <p className="text-slate-600 font-medium text-lg mb-8 max-w-md mx-auto">Hubo un problema al iniciar el motor de WhatsApp. La carpeta temporal puede estar bloqueada o corrompida.</p>
              <button onClick={handleRestart} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-md">
                <PlayCircle className="w-5 h-5" /> Forzar Reinicio Criptográfico
              </button>
            </div>
          ) : (
            <div className="text-center flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-6" />
              <p className="text-slate-600 font-bold text-lg mb-8">Solicitando lienzo criptográfico al servidor matriz...</p>
              <p className="text-sm text-slate-500 mb-4 max-w-sm text-center">Si esto tarda más de 30 segundos, es probable que la sesión se haya quedado trabada en el servidor.</p>
              <button onClick={handleRestart} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold flex items-center gap-2 transition-all text-sm">
                <RefreshCw className="w-4 h-4" /> Resetear Sesión Forzosamente
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 mt-8">
        <h2 className="text-2xl font-black text-slate-800 mb-2">Número Oficial de Ventas</h2>
        <p className="text-slate-500 font-medium mb-6">Ingresa el número de WhatsApp con código de país (ej. 521XXXXXXXXXX) al que tus clientes serán redirigidos cuando hagan clic en "Pagar por WhatsApp".</p>
        
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Ej: 5218112345678"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button 
            onClick={saveWhatsappNumber}
            disabled={isSaving}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold disabled:opacity-50 transition-all"
          >
            {isSaving ? "Guardando..." : "Guardar Número"}
          </button>
        </div>
      </div>
    </div>
  );
}
