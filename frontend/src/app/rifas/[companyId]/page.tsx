'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';

export default function RafflesCatalog() {
  const { companyId } = useParams();
  const router = useRouter();
  const [raffles, setRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/raffles/company/${companyId}`)
        .then(res => {
          setRaffles(res.data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [companyId]);

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700 p-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Sorteos Oficiales
          </h1>
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Plataforma Segura
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-5xl font-extrabold tracking-tight">Participa y <span className="text-blue-500">Gana</span></h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">Selecciona tu boleto de la suerte en nuestros sorteos activos y paga de forma 100% segura a través de nuestro sistema automatizado de WhatsApp.</p>
        </div>

        {/* Catalog Grid */}
        {raffles.length === 0 ? (
          <div className="text-center py-20 bg-gray-800/30 rounded-2xl border border-gray-700/50">
            <p className="text-gray-400 text-lg">No hay sorteos activos en este momento. ¡Vuelve pronto!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {raffles.map((raffle) => (
              <div key={raffle.id} className="group bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 hover:border-blue-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] flex flex-col cursor-pointer" onClick={() => router.push(`/rifas/${companyId}/${raffle.id}`)}>
                <div className="h-48 bg-gray-700 relative overflow-hidden">
                  {raffle.imageUrl ? (
                    <img src={raffle.imageUrl} alt={raffle.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-900/50 to-emerald-900/50 flex items-center justify-center">
                      <span className="text-4xl">🎁</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Activo
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-2xl font-bold mb-2">{raffle.name}</h3>
                  
                  {raffle.drawDate && (
                    <div className="flex items-center gap-2 text-indigo-400 bg-indigo-900/30 w-fit px-3 py-1.5 rounded-lg mb-3">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {new Date(raffle.drawDate).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  <p className="text-gray-400 text-sm mb-6 line-clamp-2">{raffle.description || 'Participa en este gran sorteo.'}</p>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Costo por Boleto</p>
                      <p className="text-2xl font-bold text-blue-400">${raffle.ticketPrice.toFixed(2)}</p>
                    </div>
                    <button className="bg-white/10 hover:bg-blue-600 text-white font-medium py-2 px-5 rounded-xl transition-colors duration-200">
                      Ver Boletos
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Branding MAGIA OS */}
      <div className="fixed bottom-0 left-0 w-full bg-gray-900/80 backdrop-blur-md border-t border-gray-800 p-3 z-40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-center items-center gap-2 text-center">
          <p className="text-[10px] sm:text-xs text-gray-500 font-medium">
            🚀 Desarrollo Tecnológico por <span className="font-bold text-gray-300">Grupo Hurtado</span>
          </p>
          <span className="hidden sm:inline text-gray-700">|</span>
          <p className="text-[10px] sm:text-xs text-blue-400 font-bold uppercase tracking-widest">
            Ecosistema MAGIA OS
          </p>
        </div>
      </div>
    </div>
  );
}
