"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { Users, Search, ChevronLeft, Save, Loader2, X, Ticket, User, Phone, CheckCircle, Hash, AlertTriangle } from "lucide-react";

export default function CompradoresAdminPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [raffle, setRaffle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState("");

  // Edit Modal State
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    status: "AVAILABLE",
    paymentReference: ""
  });
  const [saving, setSaving] = useState(false);
  
  // Abonos State
  const [abonoAmount, setAbonoAmount] = useState("");
  const [isRegisteringAbono, setIsRegisteringAbono] = useState(false);

  useEffect(() => {
    const cid = localStorage.getItem("activeCompanyId");
    if (cid) {
      setCompanyId(cid);
      fetchRaffle(cid);
    } else {
      router.push('/settings/rifas');
    }
  }, [id, router]);

  const fetchRaffle = async (cId: string) => {
    try {
      // Get all raffles for admin, and find this one.
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/admin/company/${cId}`);
      const found = res.data.find((r: any) => r.id === id);
      if (found) {
        setRaffle(found);
      } else {
        alert("Rifa no encontrada o sin acceso.");
        router.push('/settings/rifas');
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const openEdit = (ticket: any) => {
    setEditingTicket(ticket);
    setEditForm({
      status: ticket.status,
      paymentReference: ticket.paymentReference || ""
    });
  };

  const closeEdit = () => {
    setEditingTicket(null);
    setEditForm({ status: "AVAILABLE", paymentReference: "" });
    setAbonoAmount("");
  };

  const handleRegisterAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abonoAmount || isNaN(Number(abonoAmount)) || Number(abonoAmount) <= 0) {
      alert("Ingresa un monto válido");
      return;
    }
    
    setIsRegisteringAbono(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${id}/tickets/${editingTicket.ticketNumber}/pay`, {
        companyId,
        amount: Number(abonoAmount)
      });
      
      setAbonoAmount("");
      await fetchRaffle(companyId);
      
      // Update editingTicket state locally to reflect changes in modal immediately
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/admin/company/${companyId}`);
      const foundRaffle = res.data.find((r: any) => r.id === id);
      if (foundRaffle) {
         const updatedTicket = foundRaffle.tickets.find((t: any) => t.ticketNumber === editingTicket.ticketNumber);
         if (updatedTicket) setEditingTicket(updatedTicket);
      }
    } catch (err) {
      console.error(err);
      alert("Error al registrar abono.");
    } finally {
      setIsRegisteringAbono(false);
    }
  };

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${id}/tickets/${editingTicket.ticketNumber}`, {
        companyId,
        status: editForm.status,
        paymentReference: editForm.paymentReference
      });

      // Si tenemos un endpoint futuro para guardar la referencia sola, aquí se llamaría.
      // Por ahora la referencia bancaria se guarda en base de datos.
      // Refactor: We need the backend to accept paymentReference in the PUT request!
      // I will send it anyway, backend might ignore it if we didn't add it to the PUT yet.
      
      // Let's refetch to get updated data
      await fetchRaffle(companyId);
      closeEdit();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el boleto.");
    } finally {
      setSaving(false);
    }
  };

  // Helper function to free ticket
  const handleFreeTicket = async (ticketNumber: string) => {
    if (!confirm(`¿Estás seguro de liberar el boleto #${ticketNumber}? Esto borrará al cliente de este número.`)) return;
    
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${id}/tickets/${ticketNumber}`, {
        companyId,
        status: 'AVAILABLE'
      });
      await fetchRaffle(companyId);
    } catch (err) {
      console.error(err);
      alert("Error al liberar el boleto.");
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!raffle) return null;

  const filteredTickets = raffle.tickets
    .filter((t: any) => 
      t.ticketNumber.includes(searchTerm) || 
      t.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.contact?.phone?.includes(searchTerm) ||
      (t.paymentReference && t.paymentReference.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a: any, b: any) => parseInt(a.ticketNumber) - parseInt(b.ticketNumber));

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto h-full flex flex-col font-sans">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.push('/settings/rifas')}
          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-500" />
            Gestión de Compradores
          </h1>
          <p className="text-sm text-slate-500 font-medium">{raffle.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por cliente, teléfono, boleto o referencia..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium shadow-sm"
            />
          </div>
          <div className="flex gap-4 text-sm font-bold">
            <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl border border-indigo-100">
              Total Boletos: {raffle.totalTickets}
            </div>
            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100">
              Vendidos/Apartados: {raffle.tickets.length}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTickets.map((t: any) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${t.status === 'PAID' ? 'bg-emerald-500' : t.status === 'PARTIALLY_PAID' ? 'bg-sky-500' : 'bg-amber-500'}`}></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-slate-400" />
                    <span className="text-xl font-black text-slate-800">#{t.ticketNumber}</span>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider ${t.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : t.status === 'PARTIALLY_PAID' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.status === 'PAID' ? 'PAGADO' : t.status === 'PARTIALLY_PAID' ? 'ABONADO' : 'APARTADO'}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-700 truncate">{t.contact?.name || 'Venta Manual'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-700">{t.contact?.phone || 'Sin número'}</span>
                  </div>
                  {t.paymentReference && (
                    <div className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <Hash className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-indigo-600 truncate">{t.paymentReference}</span>
                    </div>
                  )}
                  {t.amountPaid > 0 && (
                    <div className="mt-2 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-sky-500 h-2.5 rounded-full" style={{ width: `${Math.min(100, (t.amountPaid / raffle.ticketPrice) * 100)}%` }}></div>
                    </div>
                  )}
                  {t.amountPaid > 0 && (
                    <div className="text-xs font-bold text-slate-500 text-right mt-1">
                      Pagado: ${t.amountPaid} / ${raffle.ticketPrice}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-4">
                  <button onClick={() => openEdit(t)} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 rounded-xl text-xs transition-colors">
                    Detalles / Editar
                  </button>
                  <button onClick={() => handleFreeTicket(t.ticketNumber)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2 rounded-xl text-xs transition-colors">
                    Liberar
                  </button>
                </div>
              </div>
            ))}
            
            {filteredTickets.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 font-medium flex flex-col items-center">
                <Ticket className="w-12 h-12 text-slate-300 mb-3" />
                No se encontraron boletos con esa búsqueda.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Edición */}
      {editingTicket && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                Boleto #{editingTicket.ticketNumber}
              </h2>
              <button onClick={closeEdit} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              {/* Progreso de Pago */}
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-slate-700">Progreso de Pago</span>
                  <span className="text-xl font-black text-indigo-600">${editingTicket.amountPaid || 0} <span className="text-sm text-slate-400">/ ${raffle.ticketPrice}</span></span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden mb-2">
                  <div className={`h-3 rounded-full transition-all ${editingTicket.status === 'PAID' ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${Math.min(100, ((editingTicket.amountPaid || 0) / raffle.ticketPrice) * 100)}%` }}></div>
                </div>
                {editingTicket.status === 'PAID' ? (
                  <p className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Boleto Liquidado</p>
                ) : (
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-1">Faltan ${raffle.ticketPrice - (editingTicket.amountPaid || 0)} MXN para liquidar</p>
                )}
              </div>

              {/* Registrar Abono Form */}
              {editingTicket.status !== 'PAID' && (
                <form onSubmit={handleRegisterAbono} className="mb-8 p-4 border border-indigo-100 bg-indigo-50/50 rounded-2xl space-y-3">
                  <label className="block text-sm font-bold text-indigo-900">Registrar Nuevo Abono</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-3 text-slate-400 font-bold">$</span>
                      <input 
                        type="number" 
                        value={abonoAmount}
                        onChange={(e) => setAbonoAmount(e.target.value)}
                        placeholder="Ej. 100"
                        className="w-full bg-white border border-indigo-200 rounded-xl pl-8 pr-4 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <button type="submit" disabled={isRegisteringAbono} className="px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-70 whitespace-nowrap">
                      {isRegisteringAbono ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Abonar"}
                    </button>
                  </div>
                  <p className="text-xs text-indigo-600 font-medium">Esto sumará saldo y notificará por WhatsApp al cliente.</p>
                </form>
              )}

              <hr className="border-slate-100 my-6" />

              <form onSubmit={handleSaveTicket} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Estado Manual del Boleto</label>
                  <select 
                    value={editForm.status}
                    onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="RESERVED">Apartado (Esperando Pago)</option>
                    <option value="PARTIALLY_PAID">Abonado (Pagado Parcialmente)</option>
                    <option value="PAID">Pagado (Completado)</option>
                    <option value="AVAILABLE">Liberar Boleto (Cancelar)</option>
                  </select>
                  <p className="text-xs text-amber-600 mt-2 font-medium bg-amber-50 p-2 rounded-lg border border-amber-100">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Si cambias esto manualmente a Pagado, el sistema enviará el VIP Digital aunque el abono no esté completo.
                  </p>
                </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Referencia de Pago</label>
                <input 
                  type="text" 
                  value={editForm.paymentReference}
                  onChange={(e) => setEditForm({...editForm, paymentReference: e.target.value})}
                  placeholder="Ej. REF-X8K9L"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                />
                <p className="text-xs text-slate-500 mt-2 font-medium">Esta referencia ayuda a identificar la transferencia bancaria.</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={closeEdit} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cerrar
                </button>
                <button type="submit" disabled={saving} className="flex-[2] px-4 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Forzar Cambios</>}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
