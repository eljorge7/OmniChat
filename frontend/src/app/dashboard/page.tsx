"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Building2, Plus, QrCode, Trash2, Smartphone, Key, MapPin, Search, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function DashboardPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyPassword, setNewCompanyPassword] = useState("");
  const [editingCompany, setEditingCompany] = useState<any>(null);
  
  const [qrData, setQrData] = useState<{ qr: string; status: string } | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const MASTER_KEY = "zohomasterkey_99_omnichat_x";

  const loadCompanies = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/admin/companies`, {
        headers: { Authorization: `Bearer ${MASTER_KEY}` }
      });
      setCompanies(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newCompanyEmail) return;

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/admin/companies`, {
        name: newCompanyName,
        email: newCompanyEmail,
        phone: newCompanyPhone || undefined,
        password: newCompanyPassword || undefined
      }, {
        headers: { Authorization: `Bearer ${MASTER_KEY}` }
      });
      setShowAddModal(false);
      setNewCompanyName("");
      setNewCompanyEmail("");
      setNewCompanyPhone("");
      setNewCompanyPassword("");
      loadCompanies();
      alert("✅ Agencia creada exitosamente. Las credenciales fueron enviadas al correo y WhatsApp (si se capturó).");
    } catch (e: any) {
      console.error(e);
      alert(`Error creando la empresa: ${e.response?.data?.message || e.message}`);
    }
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`🚨 ¿Estás seguro de eliminar la agencia ${name}?\nCompletamente se borrarán sus contactos, mensajes, usuarios y embudos.\n\nESTA ACCIÓN ES IRREVERSIBLE.`)) return;
    try {
       await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/admin/companies/${id}`, {
         headers: { Authorization: `Bearer ${MASTER_KEY}` }
       });
       loadCompanies();
    } catch(e) {
       alert("Error eliminando la agencia");
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    try {
       await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/admin/companies/${editingCompany.id}`, {
         name: editingCompany.name
       }, {
         headers: { Authorization: `Bearer ${MASTER_KEY}` }
       });
       setEditingCompany(null);
       loadCompanies();
    } catch(e) {
       alert("Error actualizando la empresa");
    }
  };

  const handleOpenQr = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    setQrData(null);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/qr/${companyId}`);
      setQrData(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Poll for QR status if modal is open
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedCompanyId && qrData?.status !== 'READY') {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/qr/${selectedCompanyId}`);
          setQrData(res.data);
          if (res.data.status === 'READY') {
             clearInterval(interval);
          }
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [selectedCompanyId, qrData?.status]);

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Cargando Panel Maestro...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-indigo-600" />
              OmniChat Master Agency
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Gestiona múltiples inquilinos (RentControl, Radiotec, etc.) desde este super-panel.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="h-5 w-5" /> Nueva Empresa
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div key={company.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xl">
                    {company.name.substring(0,2).toUpperCase()}
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <User className="h-3 w-3" /> {company._count?.contacts || 0} Leads
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-1 flex items-center justify-between">
                  {company.name}
                  <div className="flex gap-2">
                     <button onClick={() => setEditingCompany(company)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Editar">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                     </button>
                     <button onClick={() => handleDeleteCompany(company.id, company.name)} className="text-slate-400 hover:text-red-600 transition-colors" title="Eliminar">
                       <Trash2 className="h-4 w-4" />
                     </button>
                  </div>
                </h3>
                <p className="text-xs text-slate-500 font-mono mb-4 flex items-center gap-1">
                  <Key className="h-3 w-3" /> {company.apiKey.substring(0, 15)}...
                </p>
                <div className="flex bg-slate-50 rounded-lg p-3">
                   <div className="flex-1 text-center border-r border-slate-200">
                      <div className="text-xs text-slate-500 font-medium mb-1">Agentes</div>
                      <div className="font-bold text-slate-800">{company._count?.users || 0}</div>
                   </div>
                   <div className="flex-1 text-center">
                      <div className="text-xs text-slate-500 font-medium mb-1">WhatsApp</div>
                      <div className="font-bold text-slate-800">API</div>
                   </div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 flex gap-2">
                <button 
                  onClick={() => handleOpenQr(company.id)}
                  className="flex-1 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-bold py-2 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  <QrCode className="h-4 w-4" /> Escanear QR
                </button>
                <a 
                  href="/inbox"
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-sm text-center"
                >
                  <Smartphone className="h-4 w-4" /> Ir al Inbox
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agregar Empresa Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 md:p-8 relative mt-10">
             <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full">
               <span className="font-bold text-xl leading-none">&times;</span>
             </button>
             <h2 className="text-2xl font-black text-slate-800 mb-2">Nueva Empresa</h2>
             <p className="text-sm text-slate-500 mb-6">Añade un nuevo negocio ("tenant") al ecosistema OmniChat. Generará su propia base de datos aislada, Pipeline general y clave API M2M.</p>
             
             <form onSubmit={handleCreateCompany} className="space-y-4">
               <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Comercial</label>
                 <input 
                   required
                   autoFocus
                   type="text" 
                   value={newCompanyName}
                   onChange={e => setNewCompanyName(e.target.value)}
                   className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                   placeholder="Ej: HC Super Lavado"
                 />
               </div>
               <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">Correo de Administrador</label>
                 <input 
                   required
                   type="email" 
                   value={newCompanyEmail}
                   onChange={e => setNewCompanyEmail(e.target.value)}
                   className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                   placeholder="admin@hcsuperlavado.com"
                 />
               </div>
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono (Opcional)</label>
                   <input 
                     type="text" 
                     value={newCompanyPhone}
                     onChange={e => setNewCompanyPhone(e.target.value)}
                     className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                     placeholder="10 dígitos Ej: 8180000000"
                   />
                 </div>
                 <div className="flex-1">
                   <label className="block text-sm font-bold text-slate-700 mb-1">Contraseña Admin</label>
                   <input 
                     type="text" 
                     value={newCompanyPassword}
                     onChange={e => setNewCompanyPassword(e.target.value)}
                     className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                     placeholder="Autogenerada o teclea"
                   />
                 </div>
               </div>
               <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl mt-4 transition-all shadow-md">
                 Generar Entorno CRM y Configuración
               </button>
             </form>
          </div>
        </div>
      )}

      {/* Editar Empresa Modal */}
      {editingCompany && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 md:p-8 relative mt-10">
              <button onClick={() => setEditingCompany(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full">
                <span className="font-bold text-xl leading-none">&times;</span>
              </button>
              <h2 className="text-2xl font-black text-slate-800 mb-6">Editar Empresa</h2>
              <form onSubmit={handleUpdateCompany} className="space-y-4">
                 <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Comercial</label>
                   <input 
                     required
                     autoFocus
                     type="text" 
                     value={editingCompany.name}
                     onChange={(e) => setEditingCompany({...editingCompany, name: e.target.value})}
                     className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                   />
                 </div>
                 <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl mt-4 transition-all shadow-md">
                   Guardar Cambios
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedCompanyId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 md:p-8 text-center relative mt-10">
             <button onClick={() => setSelectedCompanyId(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full">
               <span className="font-bold text-xl leading-none">&times;</span>
             </button>
             
             <h2 className="text-2xl font-black text-slate-800 mb-2">Vincular WhatsApp Web</h2>
             
             {!qrData ? (
                <div className="py-12 animate-pulse font-bold text-slate-400">Consultando estado del motor...</div>
             ) : qrData.status === 'READY' ? (
                <div className="py-8 bg-emerald-50 rounded-2xl border border-emerald-200 my-6">
                   <div className="text-5xl mb-4">✅</div>
                   <h3 className="font-black text-emerald-800 text-xl">Sesión Activa</h3>
                   <p className="text-sm font-medium text-emerald-600 mt-2">Esta empresa ya está conectada al CRM.</p>
                </div>
             ) : qrData.status === 'AWAITING_QR' && qrData.qr ? (
                <div className="my-6">
                   <div className="bg-white p-4 inline-block rounded-2xl border-4 border-slate-100 shadow-sm mx-auto">
                     <QRCodeSVG value={qrData.qr} size={220} />
                   </div>
                   <p className="text-sm font-bold text-slate-600 mt-6 max-w-[260px] mx-auto leading-relaxed">Abre WhatsApp en tu celular, ve a Dispositivos Vinculados y escanea este código.</p>
                </div>
             ) : (
                <div className="py-12 font-bold text-amber-600 bg-amber-50 rounded-2xl border border-amber-200 my-6">
                   🚀 Motor inicializando Chromium... <br/><span className="text-xs font-normal">Espera unos segundos.</span>
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
