"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";
import { Smartphone, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

export default function WhatsappSettingsPage() {
  const [status, setStatus] = useState("INITIALIZING");
  const [qrCode, setQrCode] = useState("");

  const checkStatus = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/qr`);
      setStatus(res.data.status);
      setQrCode(res.data.qr);
    } catch (e) {
      console.error("Error fetching QR status");
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

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
          ) : (
            <div className="text-center flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-6" />
              <p className="text-slate-600 font-bold text-lg">Solicitando lienzo criptográfico al servidor matriz...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
