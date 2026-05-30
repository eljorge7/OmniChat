"use client";

import axios from "axios";
import { Plus, Gift, Edit2, Trash2, Tag, Loader2, Link as LinkIcon, Ticket, CircleDollarSign, QrCode, Users, X, Search, CheckCircle2, XCircle } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

export default function RifasAdminPage() {
  const [raffles, setRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingBuyersForRaffle, setViewingBuyersForRaffle] = useState<any>(null);
  const [buyerSearchTerm, setBuyerSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    ticketPrice: "",
    totalTickets: "",
    imageUrl: "",
    drawDate: ""
  });

  useEffect(() => {
    const cid = localStorage.getItem("activeCompanyId") || "";
    setCompanyId(cid);
    if (cid) {
      fetchRaffles(cid);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchRaffles = async (cid: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/admin/company/${cid}`);
      setRaffles(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    
    const payload = {
      companyId,
      name: formData.name,
      description: formData.description,
      ticketPrice: parseFloat(formData.ticketPrice),
      totalTickets: parseInt(formData.totalTickets),
      imageUrl: formData.imageUrl,
      drawDate: formData.drawDate ? formData.drawDate : null
    };

    try {
      if (editingId) {
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${editingId}`, payload);
      } else {
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles`, payload);
      }
      
      closeModal();
      fetchRaffles(companyId);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: "", description: "", ticketPrice: "", totalTickets: "", imageUrl: "", drawDate: "" });
  };

  const openEditModal = (raffle: any) => {
    setEditingId(raffle.id);
    setFormData({
      name: raffle.name,
      description: raffle.description || "",
      ticketPrice: raffle.ticketPrice.toString(),
      totalTickets: raffle.totalTickets.toString(),
      imageUrl: raffle.imageUrl || "",
      drawDate: raffle.drawDate ? new Date(raffle.drawDate).toISOString().slice(0, 16) : ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta rifa? Esta acción no se puede deshacer.")) return;
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${id}`, {
        data: { companyId }
      });
      fetchRaffles(companyId);
    } catch (err) {
      console.error(err);
      alert("Error al eliminar la rifa.");
    }
  };

  const handleToggleStatus = async (raffle: any) => {
    const newStatus = raffle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${raffle.id}`, {
        companyId,
        status: newStatus
      });
      fetchRaffles(companyId);
    } catch (err) {
      console.error(err);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/rifas/${companyId}/${id}`;
    navigator.clipboard.writeText(url);
    alert("¡Link copiado al portapapeles!");
  };

  const downloadQR = (id: string, name: string) => {
    const canvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR_${name.substring(0,20).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const handleTicketStatusChange = async (raffleId: string, ticketNumber: string, currentStatus: string) => {
    // Determine next status: RESERVED -> PAID -> AVAILABLE -> RESERVED
    let nextStatus = 'PAID';
    if (currentStatus === 'PAID') nextStatus = 'AVAILABLE';
    if (currentStatus === 'AVAILABLE') nextStatus = 'RESERVED';
    if (currentStatus === 'RESERVED') nextStatus = 'PAID';

    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/${raffleId}/tickets/${ticketNumber}`, {
        companyId,
        status: nextStatus
      });
      // Refresh raffles
      fetchRaffles(companyId);
      // Also update local state for the modal
      if (viewingBuyersForRaffle && viewingBuyersForRaffle.id === raffleId) {
        const updatedTickets = viewingBuyersForRaffle.tickets.map((t: any) => 
          t.ticketNumber === ticketNumber ? { ...t, status: nextStatus } : t
        );
        // If it was AVAILABLE and changed to RESERVED, and wasn't in array, we need to handle that, 
        // but for simplicity it's better to just close/reopen or wait for fetchRaffles. 
        // To be completely robust, we fetch and update the single object.
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/admin/company/${companyId}`);
        setRaffles(res.data);
        const updatedRaffle = res.data.find((r: any) => r.id === raffleId);
        if (updatedRaffle) setViewingBuyersForRaffle(updatedRaffle);
      }
    } catch (err) {
      console.error(err);
      alert("Error actualizando boleto");
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
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Gift className="w-8 h-8 text-indigo-600" /> Gestor de Rifas
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Administra tus sorteos, boletos y enlaces públicos.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Nueva Rifa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {raffles.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <Gift className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700">No tienes rifas creadas</h3>
            <p className="text-slate-500 mt-2 mb-6">Crea tu primer sorteo para empezar a recaudar.</p>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-6 py-2.5 rounded-xl font-bold transition-colors">
              Crear mi Primera Rifa
            </button>
          </div>
        )}

        {raffles.map(r => {
          const ticketsVendidos = r.tickets?.filter((t: any) => t.status === 'PAID').length || 0;
          const ticketsApartados = r.tickets?.filter((t: any) => t.status === 'RESERVED').length || 0;
          const recaudado = ticketsVendidos * r.ticketPrice;
          const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://omnichat.radiotecpro.com'}/rifas/${companyId}/${r.id}`;
          
          return (
            <div key={r.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow">
              <div className="h-40 relative bg-slate-100 overflow-hidden">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                    <Gift className="w-12 h-12 text-indigo-200" />
                  </div>
                )}
                <div className="absolute top-4 right-4 flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black shadow-sm ${r.status === 'ACTIVE' ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'}`}>
                    {r.status === 'ACTIVE' ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-4 line-clamp-2">{r.name}</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><Ticket className="w-5 h-5"/></div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Vendidos</p>
                      <p className="text-lg font-black text-slate-900">{ticketsVendidos} <span className="text-sm font-medium text-slate-400">/ {r.totalTickets}</span></p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><CircleDollarSign className="w-5 h-5"/></div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Ingresos</p>
                      <p className="text-lg font-black text-slate-900">${recaudado.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Hidden QR Code for downloading */}
                <div className="hidden">
                  <QRCodeCanvas
                    id={`qr-${r.id}`}
                    value={url}
                    size={1024}
                    level={"H"}
                    includeMargin={true}
                  />
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-4">
                  <button onClick={() => downloadQR(r.id, r.name)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm" title="Descargar QR en Alta Calidad">
                    <QrCode className="w-4 h-4" /> Bajar QR
                  </button>
                  <button onClick={() => setViewingBuyersForRaffle(r)} className="p-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-colors" title="Ver Compradores">
                    <Users className="w-5 h-5" />
                  </button>
                  <button onClick={() => openEditModal(r)} className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors" title="Editar">
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleToggleStatus(r)} className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors" title="Pausar/Activar">
                    <Tag className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Eliminar">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-900">{editingId ? 'Editar Sorteo' : 'Crear Nuevo Sorteo'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Sorteo</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Gran Rifa Panel Solar 3.3kWh" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Descripción Corta</label>
                <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Participa y gana..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium resize-none h-24" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Precio por Boleto ($)</label>
                  <input required type="number" min="1" step="0.01" value={formData.ticketPrice} onChange={e => setFormData({...formData, ticketPrice: e.target.value})} placeholder="Ej. 400" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Total de Boletos</label>
                  <input required type="number" min="1" value={formData.totalTickets} onChange={e => setFormData({...formData, totalTickets: e.target.value})} placeholder="Ej. 200" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">URL de Imagen (Opcional)</label>
                  <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Fecha del Sorteo (Opcional)</label>
                  <input type="datetime-local" value={formData.drawDate} onChange={e => setFormData({...formData, drawDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm text-slate-600" />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-[2] px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Sorteo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingBuyersForRaffle && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-black text-slate-900">Lista de Compradores</h2>
                <p className="text-sm text-slate-500 font-medium">{viewingBuyersForRaffle.name}</p>
              </div>
              <button onClick={() => setViewingBuyersForRaffle(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-3 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, teléfono o número de boleto..." 
                  value={buyerSearchTerm}
                  onChange={(e) => setBuyerSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-4 flex-1 bg-slate-50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 text-sm font-bold text-slate-500 border-b border-slate-200">Boleto</th>
                    <th className="p-3 text-sm font-bold text-slate-500 border-b border-slate-200">Cliente</th>
                    <th className="p-3 text-sm font-bold text-slate-500 border-b border-slate-200">WhatsApp</th>
                    <th className="p-3 text-sm font-bold text-slate-500 border-b border-slate-200 text-center">Estado</th>
                    <th className="p-3 text-sm font-bold text-slate-500 border-b border-slate-200 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingBuyersForRaffle.tickets
                    .filter((t: any) => 
                      t.ticketNumber.includes(buyerSearchTerm) || 
                      t.contact?.name?.toLowerCase().includes(buyerSearchTerm.toLowerCase()) ||
                      t.contact?.phone?.includes(buyerSearchTerm)
                    )
                    .sort((a: any, b: any) => parseInt(a.ticketNumber) - parseInt(b.ticketNumber))
                    .map((t: any) => (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-white transition-colors">
                        <td className="p-3 font-black text-slate-700">#{t.ticketNumber}</td>
                        <td className="p-3 font-medium text-slate-600">{t.contact?.name || 'Manual'}</td>
                        <td className="p-3 font-medium text-slate-600">{t.contact?.phone || '-'}</td>
                        <td className="p-3 text-center">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${t.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {t.status === 'PAID' ? 'PAGADO' : 'APARTADO'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => handleTicketStatusChange(viewingBuyersForRaffle.id, t.ticketNumber, t.status)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Cambiar Estado
                          </button>
                        </td>
                      </tr>
                  ))}
                  {viewingBuyersForRaffle.tickets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No hay boletos vendidos o apartados aún.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
