"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { Users, Search, ChevronLeft, Save, Loader2, X, Ticket, User, Phone, CheckCircle, Hash, AlertTriangle, LayoutGrid, List, Calendar, Bell } from "lucide-react";

export default function CompradoresAdminPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [raffle, setRaffle] = useState<any>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState("");

  // Edit Modal State
  const [editingKit, setEditingKit] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  
  // Abonos State
  const [abonoAmount, setAbonoAmount] = useState("");
  const [isRegisteringAbono, setIsRegisteringAbono] = useState(false);
  const [isSecuring, setIsSecuring] = useState(false);
  
  // Contact Edit State
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editedContactName, setEditedContactName] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Manual Sale State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualData, setManualData] = useState({ name: "", phone: "", tickets: "", sellerId: "" });
  const [isReservingManual, setIsReservingManual] = useState(false);

  const [isGeneratingFlyer, setIsGeneratingFlyer] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [isResendingOpps, setIsResendingOpps] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "compact">("grid");

  const handleDownloadFlyer = async () => {
    setIsGeneratingFlyer(true);
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${id}/flyer`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `numeros_disponibles_rifa.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
      alert('Hubo un error al generar el flyer de números disponibles.');
    } finally {
      setIsGeneratingFlyer(false);
    }
  };

  const handleManualReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualData.tickets) return alert("Ingresa al menos un boleto");
    if (!manualData.name || !manualData.phone) return alert("Nombre y teléfono son obligatorios");

    setIsReservingManual(true);
    try {
      const parsedTickets = manualData.tickets.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const paddingLength = raffle?.totalTickets?.toString().length || 5;
      const finalTickets = parsedTickets.map(t => String(t).padStart(paddingLength, '0'));

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/raffles/${id}/reserve`, {
        ticketNumbers: finalTickets,
        contactName: manualData.name,
        contactPhone: manualData.phone,
        sellerId: manualData.sellerId || undefined
      });

      alert("Boletos apartados exitosamente");
      setShowManualModal(false);
      setManualData({ name: "", phone: "", tickets: "", sellerId: "" });
      fetchRaffle(companyId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al apartar boletos');
    } finally {
      setIsReservingManual(false);
    }
  };

  const handleSendRemindersClick = () => {
    setShowRemindersModal(true);
  };

  const confirmSendReminders = async () => {
    setIsSendingReminders(true);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/raffles/${id}/reminders`, {
        companyId
      });
      alert(res.data.message || "Recordatorios enviados exitosamente");
      setShowRemindersModal(false);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error al enviar recordatorios');
    } finally {
      setIsSendingReminders(false);
    }
  };

  const handleResendOpportunitiesClick = async () => {
    if (!confirm("¿Deseas reenviar los boletos VIP actualizados (con sus 5 oportunidades) a todos los clientes que ya pagaron?\n\nEsto usará tu conexión actual de OmniChat de forma automática.")) return;
    setIsResendingOpps(true);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/raffles/${id}/resend-opportunities`);
      alert(res.data.message || "Boletos VIP reenviados con éxito");
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error al reenviar boletos VIP');
    } finally {
      setIsResendingOpps(false);
    }
  };

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

      // Fetch sellers
      const sellersRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/sellers`, { headers: { 'x-company-id': cId } });
      setSellers(sellersRes.data.filter((s: any) => s.raffles?.some((r: any) => r.id === id)));

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const openEdit = (kit: any) => {
    setEditingKit(kit);
  };

  const closeEdit = () => {
    setEditingKit(null);
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
      const ticketNumbers = editingKit.tickets.map((t: any) => t.ticketNumber);
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${id}/tickets/kit-pay`, {
        companyId,
        ticketNumbers,
        amount: Number(abonoAmount)
      });
      
      setAbonoAmount("");
      await fetchRaffle(companyId);
      
      // Update editingKit state locally to reflect changes in modal immediately
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/admin/company/${companyId}`);
      const foundRaffle = res.data.find((r: any) => r.id === id);
      if (foundRaffle) {
         // Rebuild the kit manually
         const updatedTickets = foundRaffle.tickets.filter((t: any) => ticketNumbers.includes(t.ticketNumber));
         const totalPaid = updatedTickets.reduce((sum: number, t: any) => sum + (t.amountPaid || 0), 0);
         const kitStatus = updatedTickets.every((t: any) => t.status === 'PAID') ? 'PAID' : 'PARTIALLY_PAID';
         setEditingKit({
           ...editingKit,
           tickets: updatedTickets,
           amountPaid: totalPaid,
           status: kitStatus
         });
      }
    } catch (err) {
      console.error(err);
      alert("Error al registrar abono del paquete.");
    } finally {
      setIsRegisteringAbono(false);
    }
  };

  const handleSecureApartado = async () => {
    if (!confirm("¿Deseas fijar este apartado? El sistema ya no lo cancelará automáticamente a las 12 horas, aunque tenga $0 abonados.")) return;
    setIsSecuring(true);
    try {
      const ticketNumbers = editingKit.tickets.map((t: any) => t.ticketNumber);
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${id}/tickets/kit-secure`, {
        companyId,
        ticketNumbers
      });
      await fetchRaffle(companyId);
      
      // Update local state so it shows as LOCKED and the button disappears
      setEditingKit({
        ...editingKit,
        status: 'LOCKED'
      });
    } catch (err) {
      console.error(err);
      alert("Error al fijar el apartado.");
    } finally {
      setIsSecuring(false);
    }
  };

  const handleUpdateContactName = async () => {
    if (!editingKit || !editingKit.contact) return;
    if (editedContactName.trim() === "" || editedContactName === editingKit.contact.name) {
       setIsEditingContact(false);
       return;
    }
    
    setIsSavingContact(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/contacts/rename`, {
         contactId: editingKit.contact.id,
         newName: editedContactName
      });
      // Update local state so it reflects immediately
      setEditingKit({
         ...editingKit,
         contact: { ...editingKit.contact, name: editedContactName }
      });
      fetchRaffle(companyId); // Refresh table
    } catch (e) {
      console.error(e);
      alert("Error al actualizar el nombre del contacto.");
    } finally {
      setIsSavingContact(false);
      setIsEditingContact(false);
    }
  };

  // Helper function to free kit
  const handleFreeKit = async (kit: any) => {
    if (!confirm(`¿Estás seguro de liberar este paquete de ${kit.tickets.length} boletos? Esto borrará al cliente de estos números.`)) return;
    
    try {
      await Promise.all(kit.tickets.map((t: any) => 
        axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${id}/tickets/${t.ticketNumber}`, {
          companyId,
          status: 'AVAILABLE'
        })
      ));
      await fetchRaffle(companyId);
    } catch (err) {
      console.error(err);
      alert("Error al liberar los boletos.");
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
    .filter((t: any) => t.status !== 'AVAILABLE')
    .filter((t: any) => 
      t.ticketNumber.includes(searchTerm) || 
      t.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.contact?.phone?.includes(searchTerm) ||
      (t.paymentReference && t.paymentReference.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  // Agrupar tickets en Kits
  const kitsMap = new Map();
  filteredTickets.forEach((t: any) => {
    // Agrupamos por paymentReference. Si no tiene, por contactId. Si tampoco, por su ticketNumber (compras manuales sueltas).
    const kitKey = t.paymentReference || t.contact?.id || t.ticketNumber;
    if (!kitsMap.has(kitKey)) {
      kitsMap.set(kitKey, {
        id: kitKey,
        tickets: [],
        contact: t.contact,
        paymentReference: t.paymentReference,
        amountPaid: 0,
        totalPrice: 0,
      });
    }
    const kit = kitsMap.get(kitKey);
    kit.tickets.push(t);
    kit.amountPaid += (t.amountPaid || 0);
    kit.totalPrice += raffle.ticketPrice;
  });

  const kits = Array.from(kitsMap.values()).map((kit: any) => {
    const allPaid = kit.tickets.every((t: any) => t.status === 'PAID');
    const anyPartiallyPaid = kit.tickets.some((t: any) => t.status === 'PARTIALLY_PAID');
    
    if (allPaid) {
      kit.status = 'PAID';
    } else if (kit.amountPaid > 0) {
      kit.status = 'PARTIALLY_PAID'; // Real Abono
    } else if (anyPartiallyPaid) {
      kit.status = 'LOCKED'; // Fijado sin abono (DB is PARTIALLY_PAID but amountPaid is 0)
    } else {
      kit.status = 'APARTADO'; // Regular reservation
    }
    
    kit.tickets.sort((a: any, b: any) => parseInt(a.ticketNumber) - parseInt(b.ticketNumber));
    kit.reservedAt = kit.tickets[0]?.reservedAt;
    return kit;
  });

  const pendingKits = kits.filter((kit: any) => kit.status !== 'PAID' && kit.contact?.phone);

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
          <div className="flex gap-4 text-sm font-bold flex-wrap">
            <button 
              onClick={handleDownloadFlyer}
              disabled={isGeneratingFlyer}
              className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              {isGeneratingFlyer ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Generar Flyer
            </button>
            <button 
              onClick={handleSendRemindersClick}
              disabled={isSendingReminders}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              {isSendingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Recordatorios
            </button>
            <button 
              onClick={handleResendOpportunitiesClick}
              disabled={isResendingOpps}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              {isResendingOpps ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
              Reenviar VIP (+200)
            </button>
            <button 
              onClick={() => setShowManualModal(true)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              + Apartar Manual
            </button>
            <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl border border-indigo-100 flex items-center">
              Total: {raffle.totalTickets}
            </div>
            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 flex items-center">
              Vendidos: {raffle.tickets.length}
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
               <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`} title="Vista de Tarjetas">
                  <LayoutGrid className="w-4 h-4" />
               </button>
               <button onClick={() => setViewMode("compact")} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'compact' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Compacta">
                  <List className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-2"}>
            {kits.map((kit: any) => (
              viewMode === 'grid' ? (
                <div key={kit.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col">
                  <div className={`absolute top-0 left-0 w-1 h-full ${kit.status === 'PAID' ? 'bg-emerald-500' : kit.status === 'PARTIALLY_PAID' ? 'bg-sky-500' : kit.status === 'LOCKED' ? 'bg-purple-500' : 'bg-amber-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-slate-400" />
                        <span className="text-xl font-black text-slate-800">
                          {kit.tickets.length === 1 
                            ? `#${kit.tickets[0].ticketNumber}` 
                            : kit.tickets.length <= 3 
                              ? kit.tickets.map((t:any) => `#${t.ticketNumber}`).join(', ')
                              : `#${kit.tickets[0].ticketNumber} y ${kit.tickets.length - 1} más`}
                        </span>
                      </div>
                      {kit.tickets.length > 1 && (
                        <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md w-fit">Paquete de {kit.tickets.length}</span>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1 ${kit.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : kit.status === 'PARTIALLY_PAID' ? 'bg-sky-100 text-sky-700' : kit.status === 'LOCKED' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                      {kit.status === 'LOCKED' && <span className="text-[10px]">🔒</span>}
                      {kit.status === 'PAID' ? 'PAGADO' : kit.status === 'PARTIALLY_PAID' ? 'ABONADO' : kit.status === 'LOCKED' ? 'FIJADO' : 'APARTADO'}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-700 truncate">{kit.contact?.name || 'Venta Manual'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-700">{kit.contact?.phone || 'Sin número'}</span>
                    </div>
                    {kit.reservedAt && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-700">{new Date(kit.reservedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    )}
                    {kit.paymentReference && (
                      <div className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <Hash className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-indigo-600 truncate">{kit.paymentReference}</span>
                      </div>
                    )}
                    {kit.amountPaid > 0 && (
                      <div className="mt-2 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-sky-500 h-2.5 rounded-full" style={{ width: `${Math.min(100, (kit.amountPaid / kit.totalPrice) * 100)}%` }}></div>
                      </div>
                    )}
                    <div className="text-xs font-bold text-slate-500 text-right mt-1">
                      Pagado: ${kit.amountPaid} / ${kit.totalPrice}
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-100 pt-4 mt-auto">
                    <button onClick={() => openEdit(kit)} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 rounded-xl text-xs transition-colors">
                      Detalles / Editar
                    </button>
                    {kit.status !== 'PAID' && (
                      <button onClick={() => handleFreeKit(kit)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2 rounded-xl text-xs transition-colors">
                        Liberar
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div key={kit.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
                   <div className="flex items-center gap-4">
                      <div className={`w-2 h-12 rounded-full ${kit.status === 'PAID' ? 'bg-emerald-500' : kit.status === 'PARTIALLY_PAID' ? 'bg-sky-500' : kit.status === 'LOCKED' ? 'bg-purple-500' : 'bg-amber-500'}`}></div>
                      <div>
                         <div className="flex items-center gap-2">
                           <span className="font-black text-slate-800">
                             {kit.tickets.length === 1 
                               ? `#${kit.tickets[0].ticketNumber}` 
                               : kit.tickets.length <= 3 
                                 ? kit.tickets.map((t:any) => `#${t.ticketNumber}`).join(', ')
                                 : `#${kit.tickets[0].ticketNumber} y ${kit.tickets.length - 1} más`}
                           </span>
                           <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider flex items-center gap-1 ${kit.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : kit.status === 'PARTIALLY_PAID' ? 'bg-sky-100 text-sky-700' : kit.status === 'LOCKED' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                             {kit.status === 'LOCKED' && <span className="text-[9px]">🔒</span>}
                             {kit.status === 'PAID' ? 'PAGADO' : kit.status === 'PARTIALLY_PAID' ? 'ABONADO' : kit.status === 'LOCKED' ? 'FIJADO' : 'APARTADO'}
                           </span>
                         </div>
                         <div className="text-xs text-slate-500 mt-0.5 flex gap-3">
                            <span className="flex items-center gap-1"><User className="w-3 h-3"/> {kit.contact?.name || 'Venta Manual'}</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {kit.contact?.phone || 'Sin número'}</span>
                            {kit.reservedAt && (
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(kit.reservedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            )}
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                         <div className="text-xs font-bold text-slate-700">${kit.amountPaid} / ${kit.totalPrice}</div>
                         {kit.amountPaid > 0 && (
                            <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden ml-auto">
                              <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (kit.amountPaid / kit.totalPrice) * 100)}%` }}></div>
                            </div>
                         )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(kit)} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors">
                          Editar
                        </button>
                        {kit.status !== 'PAID' && (
                          <button onClick={() => handleFreeKit(kit)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-xs transition-colors hidden sm:block">
                            Liberar
                          </button>
                        )}
                      </div>
                   </div>
                </div>
              )
            ))}
          </div>
        </div>            
            {filteredTickets.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 font-medium flex flex-col items-center">
                <Ticket className="w-12 h-12 text-slate-300 mb-3" />
                No se encontraron boletos con esa búsqueda.
              </div>
            )}
      </div>

      {/* Edit Kit Modal */}
      {editingKit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-500" />
                Paquete de Boletos
              </h3>
              <button onClick={closeEdit} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <span className="text-3xl font-black text-slate-800 tracking-tight">
                   {editingKit.tickets.length === 1 
                     ? `#${editingKit.tickets[0].ticketNumber}` 
                     : `${editingKit.tickets.length} Boletos`}
                </span>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1.5 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1 ${editingKit.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : editingKit.status === 'PARTIALLY_PAID' ? 'bg-sky-100 text-sky-700' : editingKit.status === 'LOCKED' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                    {editingKit.status === 'LOCKED' && <span>🔒</span>}
                    {editingKit.status === 'PAID' ? 'PAGADO' : editingKit.status === 'PARTIALLY_PAID' ? 'ABONADO' : editingKit.status === 'LOCKED' ? 'FIJADO' : 'APARTADO'}
                  </span>
                  {editingKit.reservedAt && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                      <Calendar className="w-3 h-3" />
                      {new Date(editingKit.reservedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
              </div>

              {editingKit.contact && (
                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between group">
                   <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nombre del Cliente</p>
                     {isEditingContact ? (
                        <input 
                           autoFocus
                           value={editedContactName}
                           onChange={e => setEditedContactName(e.target.value)}
                           onBlur={handleUpdateContactName}
                           onKeyDown={e => e.key === 'Enter' && handleUpdateContactName()}
                           className="font-bold text-slate-800 bg-white px-2 py-1 rounded outline-none border border-indigo-200 w-full text-sm shadow-inner"
                           placeholder="Ej. Juan Pérez"
                           disabled={isSavingContact}
                        />
                     ) : (
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-slate-800">{editingKit.contact.name}</span>
                           <span className="text-xs text-slate-400">({editingKit.contact.phone.replace('@c.us', '')})</span>
                        </div>
                     )}
                   </div>
                   {!isEditingContact && (
                     <button 
                       onClick={() => { setIsEditingContact(true); setEditedContactName(editingKit.contact.name || ""); }}
                       className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                       title="Editar Nombre"
                     >
                        <User className="w-4 h-4" />
                     </button>
                   )}
                </div>
              )}

              <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {raffle?.opportunitiesMultiplier && raffle.opportunitiesMultiplier > 1 ? 'Números Incluidos (Boleto VIP)' : 'Números Incluidos'}
                </p>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                  {raffle?.opportunitiesMultiplier && raffle.opportunitiesMultiplier > 1 
                    ? editingKit.tickets.flatMap((t:any) => 
                        Array.from({ length: raffle.opportunitiesMultiplier }).map((_, i) => 
                          String(parseInt(t.ticketNumber, 10) + (raffle.totalTickets * i)).padStart(t.ticketNumber.length, '0')
                        )
                      ).join(', ')
                    : editingKit.tickets.map((t:any) => t.ticketNumber).join(', ')
                  }
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Costo Total del Paquete</span>
                  <span className="font-bold text-slate-800">${editingKit.totalPrice}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Pagado hasta ahora</span>
                  <span className="font-bold text-emerald-600">${editingKit.amountPaid}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-4 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Restante por pagar</span>
                  <span className="font-bold text-amber-600">${Math.max(0, editingKit.totalPrice - editingKit.amountPaid)}</span>
                </div>
              </div>

              {/* Ingresar Abono Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-500" />
                  Registrar Pago o Abono
                </h4>
                <form onSubmit={handleRegisterAbono} className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                    <input 
                      type="number"
                      placeholder="Monto"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                      value={abonoAmount}
                      onChange={e => setAbonoAmount(e.target.value)}
                      disabled={isRegisteringAbono || editingKit.status === 'PAID'}
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isRegisteringAbono || editingKit.status === 'PAID'}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-6 rounded-xl transition-colors flex items-center justify-center min-w-[100px]"
                  >
                    {isRegisteringAbono ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar"}
                  </button>
                </form>
                {editingKit.status === 'PAID' && (
                  <p className="text-xs text-emerald-600 font-bold mt-3 text-center">Este paquete ya está totalmente pagado.</p>
                )}
              </div>

              {editingKit.status === 'APARTADO' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 relative overflow-hidden flex flex-col items-center text-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mb-2" />
                  <h4 className="text-sm font-bold text-amber-800 mb-1">Evitar Cancelación Automática</h4>
                  <p className="text-xs text-amber-700/80 mb-4">Si confías en que el cliente pagará después, fija el apartado para que el sistema no libere los boletos a las 12 horas.</p>
                  <button 
                    onClick={handleSecureApartado}
                    disabled={isSecuring}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold py-2 px-6 rounded-xl transition-colors flex items-center justify-center w-full shadow-sm"
                  >
                    {isSecuring ? <Loader2 className="w-5 h-5 animate-spin" /> : "🔒 Fijar Apartado (Bloquear)"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Reserve Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-500" />
                Apartar Manualmente
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleManualReserve} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Números de Boleto</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej. 15, 20, 105" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={manualData.tickets}
                  onChange={e => setManualData({...manualData, tickets: e.target.value})}
                />
                <p className="text-xs text-slate-500 mt-1">Separa los números con comas.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Cliente</label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    placeholder="Ej. Juan Pérez" 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={manualData.name}
                    onChange={e => setManualData({...manualData, name: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Celular (WhatsApp)</label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    placeholder="Ej. 5512345678" 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={manualData.phone}
                    onChange={e => setManualData({...manualData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Vendedor (Opcional)</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={manualData.sellerId}
                  onChange={e => setManualData({...manualData, sellerId: e.target.value})}
                >
                  <option value="">-- Sin vendedor --</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isReservingManual}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
                >
                  {isReservingManual ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Apartado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminders Modal */}
      {showRemindersModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                Enviar Recordatorios
              </h3>
              <button onClick={() => setShowRemindersModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                 <div>
                    <h4 className="text-sm font-bold text-amber-800">Se enviarán a {pendingKits.length} clientes</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      El sistema mandará un mensaje individual por WhatsApp a todos los clientes que tienen boletos en estado "Apartado" o "Abonado" y tienen un número de celular registrado.
                    </p>
                 </div>
              </div>

              <div>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ejemplo del Mensaje que se enviará:</p>
                 <div className="bg-slate-100 p-4 rounded-xl text-sm text-slate-700 whitespace-pre-wrap font-medium">
                   {`👋 ¡Hola [Nombre del Cliente]!\n\nTe escribimos de parte de ${raffle.company?.name || 'la empresa'} para saludarte y recordarte sobre tu paquete de boletos apartados para la rifa "${raffle.name}".\n\n🎟️ Tus boletos: [Boletos]\n✅ Abonado: $[Abono] MXN\n⏳ Restante por pagar: $[Deuda] MXN\n\n💳 PAGA EN LÍNEA (Tarjeta u Oxxo):\n👉 Da clic aquí para pagar y asegurar tus boletos:\n[Link de Pago]\n\nQueremos recordarte que somos una empresa 100% seria y fiable en la generación de sorteos. Tu participación es muy importante para nosotros.\n\nSi tienes alguna duda o deseas reportar tu pago, ¡estamos a tus órdenes!`}
                 </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowRemindersModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmSendReminders} 
                  disabled={isSendingReminders || pendingKits.length === 0}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
                >
                  {isSendingReminders ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar y Enviar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
