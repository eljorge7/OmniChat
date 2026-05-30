'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { Gift, Calendar, Ticket, ChevronRight, CheckCircle2, ChevronDown, Check, Loader2, PartyPopper, Phone, Search, X, ShieldCheck, Zap, Clock, Sparkles } from "lucide-react";

export default function RaffleDetail() {
  const { companyId, id } = useParams();
  const router = useRouter();
  const [raffle, setRaffle] = useState<any>(null);
  const [branding, setBranding] = useState<{ logoUrl?: string, themeColor?: string }>({});
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [reserving, setReserving] = useState(false);

  // Engine State
  const [activeTab, setActiveTab] = useState<'ROULETTE' | 'SEARCH' | 'GRID'>('ROULETTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [rouletteAmount, setRouletteAmount] = useState(3);
  const [isSpinning, setIsSpinning] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (id && companyId) {
      Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/raffles/${id}`),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/companies/${companyId}/public`).catch(() => ({ data: {} }))
      ]).then(([raffleRes, brandingRes]) => {
        setRaffle(raffleRes.data);
        if (brandingRes.data) {
          setBranding({
            logoUrl: brandingRes.data.logoUrl,
            themeColor: brandingRes.data.themeColor || '#3B82F6'
          });
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [id, companyId]);

  useEffect(() => {
    if (raffle?.drawDate) {
      const target = new Date(raffle.drawDate).getTime();
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = target - now;
        if (distance < 0) {
          clearInterval(interval);
          return;
        }
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [raffle]);

  const toggleTicket = (num: string) => {
    if (selectedTickets.includes(num)) {
      setSelectedTickets(selectedTickets.filter(t => t !== num));
    } else {
      setSelectedTickets([...selectedTickets, num]);
    }
  };

  const spinRoulette = () => {
    setIsSpinning(true);
    
    // Build array of available tickets
    const ticketMap = new Map();
    raffle.tickets.forEach((t: any) => ticketMap.set(t.ticketNumber, t.status));
    
    const available: string[] = [];
    const paddingLength = raffle.totalTickets.toString().length;
    for (let i = 0; i < raffle.totalTickets; i++) {
      const num = i.toString().padStart(paddingLength, '0');
      if (!ticketMap.has(num) || ticketMap.get(num) === 'AVAILABLE') {
        if (!selectedTickets.includes(num)) {
          available.push(num);
        }
      }
    }

    setTimeout(() => {
      setIsSpinning(false);
      if (available.length < rouletteAmount) {
        alert("¡Ya no quedan suficientes boletos disponibles!");
        return;
      }
      
      // Shuffle array
      const shuffled = [...available].sort(() => 0.5 - Math.random());
      const picked = shuffled.slice(0, rouletteAmount);
      setSelectedTickets(prev => [...prev, ...picked]);
    }, 1500); // 1.5s spin animation
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const paddingLength = raffle.totalTickets.toString().length;
    let query = searchQuery.padStart(paddingLength, '0');
    
    if (parseInt(query) >= raffle.totalTickets) {
      alert("El número de boleto excede el total del sorteo.");
      return;
    }

    const ticketMap = new Map();
    raffle.tickets.forEach((t: any) => ticketMap.set(t.ticketNumber, t.status));
    
    const status = ticketMap.get(query);
    if (status === 'RESERVED' || status === 'PAID') {
      alert(`El boleto #${query} ya está ${status === 'PAID' ? 'pagado' : 'apartado'}.`);
      return;
    }

    if (!selectedTickets.includes(query)) {
      setSelectedTickets([...selectedTickets, query]);
      setSearchQuery("");
      alert(`¡Boleto #${query} añadido a tu lista!`);
    } else {
      alert("Ya tienes este boleto seleccionado.");
    }
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTickets.length === 0) return alert('Por favor selecciona al menos un boleto.');
    if (formData.phone.length < 10) return alert('Por favor ingresa un número de WhatsApp válido.');

    setReserving(true);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/raffles/${id}/reserve`, {
        ticketNumbers: selectedTickets,
        contactName: formData.name,
        contactPhone: formData.phone
      });

      const totalAmount = selectedTickets.length * raffle.ticketPrice;
      const refCode = res.data.paymentReference || 'N/A';
      const message = `Hola! Vengo de la página web. Quiero confirmar el apartado de mis boletos: ${selectedTickets.join(', ')} para la rifa "${raffle.name}".\nTotal: $${totalAmount} MXN.\nMi referencia de pago es: *${refCode}*.\nAquí tengo mi comprobante listo.`;
      
      const encodedMessage = encodeURIComponent(message);
      alert(`¡Boletos reservados! Tu referencia de pago es: ${refCode}.\n\nSerás redirigido a WhatsApp para enviar tu comprobante.`);
      window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
      window.location.reload();
      
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al reservar los boletos.');
      setReserving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-indigo-500" /></div>;
  if (!raffle) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Rifa no encontrada.</div>;

  const paddingLength = raffle.totalTickets.toString().length;
  const ticketMap = new Map();
  raffle.tickets.forEach((t: any) => ticketMap.set(t.ticketNumber, t.status));

  // Build grid if active tab is GRID
  const grid = [];
  if (activeTab === 'GRID') {
    for (let i = 0; i < raffle.totalTickets; i++) {
      grid.push(i.toString().padStart(paddingLength, '0'));
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans pb-24 selection:bg-indigo-500/30">
      {/* Header Premium */}
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
          <button onClick={() => router.push(`/rifas/${companyId}`)} className="text-slate-400 hover:text-white transition flex items-center gap-2 font-semibold">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">←</div>
            <span className="hidden sm:inline">Catálogo</span>
          </button>
          <div className="flex items-center gap-3">
              {branding.logoUrl ? (
               <img src={branding.logoUrl.replace('http://localhost:3002/uploads', typeof window !== 'undefined' ? window.location.origin.replace('https://', 'https://api.') + '/api/uploads' : 'https://api.omnichat.radiotecpro.com/api/uploads')} alt="Logo" className="h-10 sm:h-12 object-contain" />
              ) : (
               <span className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase drop-shadow-md bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, ${branding.themeColor || '#818cf8'}, #34d399)` }}>
                 SORTEOS HURTADO
               </span>
             )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Lado Izquierdo: Poster e Info */}
        <div className="lg:col-span-5 space-y-8">
          <div className="relative rounded-3xl overflow-hidden bg-slate-800 shadow-2xl shadow-indigo-900/20 ring-1 ring-slate-700/50 group">
            {raffle.imageUrl ? (
              <div className="aspect-[4/3] w-full relative">
                <img src={raffle.imageUrl} alt={raffle.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
              </div>
            ) : (
              <div className="aspect-[4/3] w-full bg-indigo-900/20 flex items-center justify-center">
                <Ticket className="w-20 h-20 text-indigo-500/30" />
              </div>
            )}
            
            <div className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg">
              Activo
            </div>
            
            <div className="absolute bottom-0 left-0 w-full p-6">
              <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-2 drop-shadow-lg">{raffle.name}</h1>
              <p className="text-indigo-300 font-bold text-xl flex items-center gap-2 drop-shadow-md">
                ${raffle.ticketPrice.toFixed(2)} MXN <span className="text-sm text-slate-300 font-medium">/ boleto</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Acerca del Sorteo</h3>
            <p className="text-slate-400 leading-relaxed mb-6">
              {raffle.description || "Participa en este gran sorteo y gana increíbles premios."}
            </p>

            {raffle.drawDate && (
              <div className="bg-indigo-950/40 rounded-2xl p-5 border border-indigo-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Fecha del Sorteo</span>
                </div>
                <div className="text-lg font-black text-white mb-5 capitalize">
                  {new Date(raffle.drawDate).toLocaleString('es-MX', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
                
                {/* Countdown */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-900 rounded-xl p-3 text-center border border-slate-800">
                    <div className="text-2xl font-black text-white">{timeLeft.days}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Días</div>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-3 text-center border border-slate-800">
                    <div className="text-2xl font-black text-white">{timeLeft.hours}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Horas</div>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-3 text-center border border-slate-800">
                    <div className="text-2xl font-black text-white">{timeLeft.minutes}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Min</div>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-3 text-center border border-slate-800 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-500/10 animate-pulse"></div>
                    <div className="text-2xl font-black text-emerald-400 relative z-10">{timeLeft.seconds}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-1 relative z-10">Seg</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Motor de Boletos y Checkout */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Motor de Boletos */}
          <div className="bg-slate-800/80 rounded-3xl border border-slate-700 p-2 shadow-2xl">
            {/* Tabs */}
            <div className="flex p-1 bg-slate-900/50 rounded-2xl mb-6">
              <button onClick={() => setActiveTab('ROULETTE')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'ROULETTE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                <Zap className="w-4 h-4" /> La Máquina
              </button>
              <button onClick={() => setActiveTab('SEARCH')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'SEARCH' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                <Search className="w-4 h-4" /> Buscar Número
              </button>
              {raffle.totalTickets <= 2000 && (
                <button onClick={() => setActiveTab('GRID')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'GRID' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                  <Ticket className="w-4 h-4" /> Ver Tablero
                </button>
              )}
            </div>

            <div className="p-4 sm:p-6 min-h-[300px] flex flex-col justify-center">
              
              {activeTab === 'ROULETTE' && (
                <div className="text-center max-w-sm mx-auto w-full">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(99,102,241,0.4)]">
                    <Sparkles className={`w-10 h-10 text-white ${isSpinning ? 'animate-spin' : ''}`} />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">Máquina de la Suerte</h3>
                  <p className="text-slate-400 text-sm mb-8">Elige cuántos boletos quieres y el sistema escogerá los mejores números al azar por ti.</p>
                  
                  <div className="grid grid-cols-4 gap-2 mb-6">
                    {[1, 3, 5, 10].map(amt => (
                      <button 
                        key={amt} 
                        onClick={() => setRouletteAmount(amt)}
                        className={`py-3 rounded-xl font-black text-lg transition-all ${rouletteAmount === amt ? 'bg-indigo-500 text-white border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-900 text-slate-400 border-2 border-transparent hover:bg-slate-800'}`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={spinRoulette}
                    disabled={isSpinning}
                    className="w-full text-white font-black text-lg py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 relative overflow-hidden group"
                    style={{ backgroundColor: branding.themeColor || '#10B981' }}
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    {isSpinning ? 'Girando Ruleta...' : '¡Probar Suerte!'}
                  </button>
                </div>
              )}

              {activeTab === 'SEARCH' && (
                <div className="text-center max-w-sm mx-auto w-full">
                  <Search className="w-16 h-16 text-indigo-500/50 mx-auto mb-6" />
                  <h3 className="text-2xl font-black text-white mb-2">Busca tu Suerte</h3>
                  <p className="text-slate-400 text-sm mb-8">Si tienes un número favorito en mente, búscalo directamente aquí.</p>
                  
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input 
                      type="number" 
                      required
                      placeholder={`Ej. 007`}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-6 py-4 text-white text-2xl font-black text-center focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 rounded-xl font-black transition-colors">
                      Añadir
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'GRID' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div> Disponible</span>
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div> Seleccionado</span>
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div> Apartado</span>
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> Pagado</span>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className={`grid gap-1.5 ${raffle.totalTickets > 500 ? 'grid-cols-10 sm:grid-cols-12 md:grid-cols-15' : 'grid-cols-8 sm:grid-cols-10'}`}>
                      {grid.map(num => {
                        const status = ticketMap.get(num) || 'AVAILABLE';
                        const isSelected = selectedTickets.includes(num);
                        
                        let bgClass = "bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-slate-700/50";
                        if (status === 'RESERVED') bgClass = "bg-amber-500/10 border-amber-500/30 text-amber-500/50 cursor-not-allowed";
                        if (status === 'PAID') bgClass = "bg-red-500/10 border-red-500/30 text-red-500/50 cursor-not-allowed";
                        if (isSelected) bgClass = "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.6)] font-black z-10 scale-110";

                        return (
                          <button 
                            key={num}
                            disabled={status !== 'AVAILABLE'}
                            onClick={() => toggleTicket(num)}
                            className={`aspect-square flex items-center justify-center rounded-md ${raffle.totalTickets > 500 ? 'text-[10px]' : 'text-xs'} transition-all duration-200 ${bgClass}`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Resumen */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-4 sm:p-6 lg:p-8 shadow-2xl relative overflow-hidden w-full box-border">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
            
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 relative z-10">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" /> Checkout
            </h2>
            
            <div className="bg-slate-950 rounded-2xl p-5 mb-8 border border-slate-800 relative z-10">
              <div className="mb-4 pb-4 border-b border-slate-800/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 font-medium">Boletos Seleccionados <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full ml-2">{selectedTickets.length}</span></span>
                  {selectedTickets.length > 0 && (
                    <button onClick={() => setSelectedTickets([])} className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition-colors bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded-lg" title="Borrar toda la selección">
                      <X className="w-3 h-3" /> Limpiar
                    </button>
                  )}
                </div>
                <div className="bg-slate-900/50 rounded-xl p-3 max-h-32 overflow-y-auto border border-slate-800/50 shadow-inner">
                  <span className="font-bold text-emerald-400 text-sm leading-relaxed tracking-wider break-words block">
                    {selectedTickets.length > 0 ? selectedTickets.join(', ') : <span className="text-slate-600 font-normal">Ninguno, usa la Máquina arriba</span>}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Total a Pagar</span>
                <span className="text-4xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                  ${(selectedTickets.length * raffle.ticketPrice).toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleReserve} className="space-y-5 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 pl-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-medium placeholder:text-slate-600"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 pl-1">WhatsApp (10 dígitos)</label>
                  <input 
                    type="tel" 
                    required 
                    minLength={10}
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-medium placeholder:text-slate-600"
                    placeholder="Ej. 6421234567"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={selectedTickets.length === 0 || reserving}
                className="w-full text-white font-black text-lg py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 relative overflow-hidden group"
                style={{ backgroundColor: branding.themeColor || '#3B82F6' }}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                {reserving ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</> : (
                  <>
                    <span>Pagar por WhatsApp</span>
                    <svg className="w-6 h-6 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.711.927 2.876.928 3.178 0 5.767-2.587 5.769-5.766 0-3.181-2.589-5.77-5.768-5.77zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z"/></svg>
                  </>
                )}
              </button>
              
              <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-4 mt-6 flex items-start gap-3">
                <Clock className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-200/80 leading-relaxed">
                  Tus boletos se reservarán durante <span className="font-bold text-indigo-300">12 horas</span>. Envía tu comprobante a nuestro Asistente con IA de WhatsApp para pintarlos de rojo automáticamente.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Branding MAGIA OS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-900/80 backdrop-blur-md border-t border-slate-800 p-3 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-center items-center gap-2 text-center">
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
            🚀 Desarrollo Tecnológico por <span className="font-bold text-slate-300">Grupo Hurtado</span>
          </p>
          <span className="hidden sm:inline text-slate-700">|</span>
          <p className="text-[10px] sm:text-xs text-indigo-400 font-bold uppercase tracking-widest">
            Ecosistema MAGIA OS
          </p>
        </div>
      </div>
      
      {/* Estilos para scrollbar custom */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.5); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.5); }
      `}} />
    </div>
  );
}
