'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';

export default function RaffleDetail() {
  const { companyId, id } = useParams();
  const router = useRouter();
  const [raffle, setRaffle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [reserving, setReserving] = useState(false);

  useEffect(() => {
    if (id) {
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/raffles/${id}`)
        .then(res => {
          setRaffle(res.data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [id]);

  const toggleTicket = (num: string) => {
    if (selectedTickets.includes(num)) {
      setSelectedTickets(selectedTickets.filter(t => t !== num));
    } else {
      setSelectedTickets([...selectedTickets, num]);
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

      // Calcular número de empresa (Normalmente se pediría al backend, aquí usamos el de la sesión o lo asume el cliente)
      // Para este MVP, el prefill de WhatsApp se manda, y asume que usan la plataforma
      const totalAmount = selectedTickets.length * raffle.ticketPrice;
      const message = `Hola! Vengo de la página web. Quiero confirmar el apartado de mis boletos: ${selectedTickets.join(', ')} para la rifa "${raffle.name}". El total es de $${totalAmount} MXN. Aquí tengo mi comprobante de pago listo.`;
      
      // We encode the message
      const encodedMessage = encodeURIComponent(message);
      
      // Alert user
      alert('¡Tus boletos han sido reservados por 12 horas! Serás redirigido a WhatsApp para enviar tu comprobante de pago.');
      
      // Para este entorno, podemos abrir el wa.me generico (idealmente deberia ser wa.me/numeroDeLaEmpresa)
      // Como no tenemos el numero del bot en el front expuesto facil, abrimos api.whatsapp.com/send
      window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
      
      // Recargar datos
      window.location.reload();
      
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al reservar los boletos.');
      setReserving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  if (!raffle) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Rifa no encontrada.</div>;

  // Generate grid numbers
  const total = raffle.totalTickets;
  const paddingLength = total.toString().length;
  const grid = [];
  
  // Map tickets for easy access
  const ticketMap = new Map();
  raffle.tickets.forEach((t: any) => {
    ticketMap.set(t.ticketNumber, t.status);
  });

  for (let i = 0; i < total; i++) {
    const num = i.toString().padStart(paddingLength, '0');
    grid.push(num);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans pb-24">
      {/* Header Minimalista */}
      <header className="bg-gray-800/80 backdrop-blur-md border-b border-gray-700 p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push(`/rifas/${companyId}`)} className="text-gray-400 hover:text-white transition">
            ← Volver
          </button>
          <h1 className="text-xl font-bold truncate">{raffle.name}</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lado Izquierdo: Grid de Boletos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Selecciona tus Números</h2>
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-700"></div> Disponible</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Seleccionado</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Reservado</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Pagado</span>
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {grid.map(num => {
                const status = ticketMap.get(num) || 'AVAILABLE';
                const isSelected = selectedTickets.includes(num);
                
                let bgClass = "bg-gray-700 hover:bg-gray-600 text-gray-300 cursor-pointer"; // AVAILABLE
                if (status === 'RESERVED') bgClass = "bg-yellow-500/20 border border-yellow-500/50 text-yellow-500 cursor-not-allowed opacity-60";
                if (status === 'PAID') bgClass = "bg-red-500/20 border border-red-500/50 text-red-500 cursor-not-allowed opacity-60";
                if (isSelected) bgClass = "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110 font-bold z-10";

                return (
                  <button 
                    key={num}
                    disabled={status !== 'AVAILABLE'}
                    onClick={() => toggleTicket(num)}
                    className={`aspect-square flex items-center justify-center rounded-lg text-sm transition-all duration-200 ${bgClass}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lado Derecho: Formulario y Checkout */}
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 shadow-xl sticky top-24">
            <h2 className="text-xl font-bold mb-4">Resumen de Apartado</h2>
            
            <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-700">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Boletos ({selectedTickets.length})</span>
                <span className="font-semibold text-white">{selectedTickets.length > 0 ? selectedTickets.join(', ') : 'Ninguno'}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-800 mt-2">
                <span className="text-gray-400">Total a Pagar</span>
                <span className="text-3xl font-bold text-emerald-400">
                  ${(selectedTickets.length * raffle.ticketPrice).toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleReserve} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp (10 dígitos)</label>
                <input 
                  type="tel" 
                  required 
                  minLength={10}
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Ej. 6421234567"
                />
              </div>

              <button 
                type="submit" 
                disabled={selectedTickets.length === 0 || reserving}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${selectedTickets.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-blue-500 hover:opacity-90 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}
              >
                {reserving ? 'Procesando...' : (
                  <>
                    <span>Apartar y Pagar vía WhatsApp</span>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.711.927 2.876.928 3.178 0 5.767-2.587 5.769-5.766 0-3.181-2.589-5.77-5.768-5.77zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z"/></svg>
                  </>
                )}
              </button>
              
              <p className="text-center text-xs text-gray-500 mt-4">
                Tus boletos se reservarán durante <span className="font-bold text-gray-400">12 horas</span>. Si el pago no es confirmado por nuestro Asistente Virtual, se liberarán automáticamente.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
