"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import { CreditCard, Save, Loader2, Key } from "lucide-react";

export default function PaymentsSettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublicKey, setStripePublicKey] = useState("");

  useEffect(() => {
    if (session?.user?.email) {
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/companies/me?email=${session.user.email}`)
        .then(res => {
          if (res.data) {
            setStripeSecretKey(res.data.stripeSecretKey || "");
            setStripePublicKey(res.data.stripePublicKey || "");
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [session]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;
    setSaving(true);
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/companies/me`, {
        email: session.user.email,
        stripeSecretKey: stripeSecretKey.trim(),
        stripePublicKey: stripePublicKey.trim()
      });
      alert("¡Llaves de Stripe guardadas exitosamente!");
    } catch (err) {
      console.error(err);
      alert("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-indigo-600" /> Pasarela de Pagos
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Configura Stripe para recibir pagos automáticos de tus rifas.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <form onSubmit={handleSave}>
          <div className="p-6 md:p-8 space-y-8">
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3">
              <Key className="w-6 h-6 text-indigo-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-indigo-900">¿Dónde encuentro estas llaves?</h3>
                <p className="text-sm text-indigo-700 mt-1">
                  Ingresa a tu panel de <a href="https://dashboard.stripe.com/apikeys" target="_blank" className="font-bold underline">Stripe Dashboard</a> y navega a la sección de "Desarrolladores" &gt; "Claves de API". Asegúrate de copiar las llaves de Modo de Prueba si apenas estás probando, o las de Modo Activo para recibir dinero real.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Clave secreta de Stripe (Secret Key)</label>
                <input
                  type="password"
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_test_..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                />
                <p className="text-xs text-slate-500 mt-2">Esta llave empieza con "sk_test_" o "sk_live_" y se usa en el servidor para validar los pagos de forma segura.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Clave pública de Stripe (Publishable Key)</label>
                <input
                  type="text"
                  value={stripePublicKey}
                  onChange={(e) => setStripePublicKey(e.target.value)}
                  placeholder="pk_test_..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                />
                <p className="text-xs text-slate-500 mt-2">Esta llave empieza con "pk_test_" o "pk_live_" y se usa para crear la ventana de pago seguro para tus clientes.</p>
              </div>
            </div>
          </div>
          <div className="px-6 md:px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-70"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
