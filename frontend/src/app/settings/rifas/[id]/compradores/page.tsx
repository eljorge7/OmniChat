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
  const [editingKit, setEditingKit] = useState<any>(null);
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
    const anyPaidOrPartial = kit.amountPaid > 0;
    kit.status = allPaid ? 'PAID' : (anyPaidOrPartial ? 'PARTIALLY_PAID' : 'APARTADO');
    kit.tickets.sort((a: any, b: any) => parseInt(a.ticketNumber) - parseInt(b.ticketNumber));
    return kit;
  });

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
            {kits.map((kit: any) => (
              <div key={kit.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col">
                <div className={`absolute top-0 left-0 w-1 h-full ${kit.status === 'PAID' ? 'bg-emerald-500' : kit.status === 'PARTIALLY_PAID' ? 'bg-sky-500' : 'bg-amber-500'}`}></div>
                
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
                  <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider ${kit.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : kit.status === 'PARTIALLY_PAID' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                    {kit.status === 'PAID' ? 'PAGADO' : kit.status === 'PARTIALLY_PAID' ? 'ABONADO' : 'APARTADO'}
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
                  <button onClick={() => handleFreeKit(kit)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2 rounded-xl text-xs transition-colors">
                    Liberar
                  </button>
                </div>
              </div>
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
                <span className={`px-3 py-1.5 text-xs font-black rounded-full uppercase tracking-wider ${editingKit.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : editingKit.status === 'PARTIALLY_PAID' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                  {editingKit.status === 'PAID' ? 'PAGADO' : editingKit.status === 'PARTIALLY_PAID' ? 'ABONADO' : 'APARTADO'}
                </span>
              </div>

              {editingKit.tickets.length > 1 && (
                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Números Incluidos</p>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed">
                    {editingKit.tickets.map((t:any) => t.ticketNumber).join(', ')}
                  </p>
                </div>
              )}

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
