"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Edit2, Trash2, Loader2, Users, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function VendedoresPage() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    raffles: [] as string[]
  });

  useEffect(() => {
    const cid = localStorage.getItem("activeCompanyId") || "";
    setCompanyId(cid);
    if (cid) {
      fetchData(cid);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchData = async (cid: string) => {
    setLoading(true);
    try {
      const [sellersRes, rafflesRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/sellers`, { headers: { 'x-company-id': cid } }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/raffles/admin/company/${cid}`)
      ]);
      setSellers(sellersRes.data);
      setRaffles(rafflesRes.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    
    try {
      const config = { headers: { 'x-company-id': companyId } };
      if (editingId) {
        await axios.patch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/sellers/${editingId}`, formData, config);
      } else {
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/sellers`, formData, config);
      }
      
      closeModal();
      fetchData(companyId);
    } catch (err) {
      console.error(err);
      alert("Error al guardar el vendedor.");
    }
    setSaving(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: "", email: "", phone: "", raffles: [] });
  };

  const openEditModal = (seller: any) => {
    setEditingId(seller.id);
    setFormData({
      name: seller.name,
      email: seller.email || "",
      phone: seller.phone,
      raffles: seller.raffles?.map((r: any) => r.id) || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este vendedor?")) return;
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/sellers/${id}`, { headers: { 'x-company-id': companyId } });
      fetchData(companyId);
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el vendedor.");
    }
  };

  const toggleRaffle = (raffleId: string) => {
    setFormData(prev => ({
      ...prev,
      raffles: prev.raffles.includes(raffleId) 
        ? prev.raffles.filter(id => id !== raffleId)
        : [...prev.raffles, raffleId]
    }));
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
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => router.push('/settings/rifas')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-600" /> Vendedores
        </h1>
      </div>

      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <p className="text-slate-500 font-medium">Gestiona tu equipo de ventas y asígnales rifas para que puedan vender.</p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Nuevo Vendedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sellers.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700">Sin Vendedores</h3>
            <p className="text-slate-500 mt-2 mb-6">Da de alta a tus vendedores para incentivarlos a promocionar tus rifas.</p>
          </div>
        )}

        {sellers.map(seller => (
          <div key={seller.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{seller.name}</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">{seller.phone}</p>
                {seller.email && <p className="text-sm text-slate-400">{seller.email}</p>}
              </div>
              <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Rifas Autorizadas</h4>
              {seller.raffles && seller.raffles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {seller.raffles.map((r: any) => (
                    <span key={r.id} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100">
                      {r.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 inline-block font-medium">No tiene rifas asignadas</p>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-4 mt-4 justify-end">
              <button onClick={() => openEditModal(seller)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors" title="Editar">
                <Edit2 className="w-5 h-5" />
              </button>
              <button onClick={() => handleDelete(seller.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Eliminar">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-black text-slate-900">{editingId ? 'Editar Vendedor' : 'Nuevo Vendedor'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre Completo</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Juan Pérez" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Celular (WhatsApp)</label>
                  <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Ej. 5512345678" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Correo (Opcional)</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="ejemplo@correo.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Asignar a Rifas</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                  {raffles.map(raffle => (
                    <label key={raffle.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        checked={formData.raffles.includes(raffle.id)}
                        onChange={() => toggleRaffle(raffle.id)}
                      />
                      <span className="font-bold text-slate-800">{raffle.name}</span>
                    </label>
                  ))}
                  {raffles.length === 0 && (
                    <p className="text-sm text-slate-500 italic">No hay rifas disponibles para asignar.</p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-[2] px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Vendedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
