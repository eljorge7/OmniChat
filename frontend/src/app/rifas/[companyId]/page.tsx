'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';

export default function RafflesCatalog() {
  const { companyId } = useParams();
  const router = useRouter();
  const [raffles, setRaffles] = useState<any[]>([]);
  const [branding, setBranding] = useState<{ logoUrl?: string, themeColor?: string }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/raffles/company/${companyId}`),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/v1/companies/${companyId}/public`).catch(() => ({ data: {} }))
      ]).then(([rafflesRes, brandingRes]) => {
        setRaffles(rafflesRes.data);
        if (brandingRes.data) {
           setBranding({
              logoUrl: brandingRes.data.logoUrl,
              themeColor: brandingRes.data.themeColor || '#3B82F6' // default blue
           });
        }
        setLoading(false);
      }).catch(err => {
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
          <div className="flex items-center">
              {branding.logoUrl ? (
               <img src={branding.logoUrl.replace('http://localhost:3002/uploads', typeof window !== 'undefined' ? window.location.origin.replace('https://', 'https://api.') + '/api/uploads' : 'https://api.omnichat.radiotecpro.com/api/uploads')} alt="Logo" className="h-16 sm:h-24 max-w-[200px] sm:max-w-[300px] object-contain drop-shadow-md" />
              ) : (
               <span className="text-2xl font-black text-white tracking-wider uppercase drop-shadow-md bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, ${branding.themeColor || '#3B82F6'}, #10B981)` }}>
                 SORTEOS HURTADO
               </span>
             )}
          </div>
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: branding.themeColor || '#10B981' }}></span>
            Plataforma Segura
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center space-y-6 mb-12 md:mb-16">
          <h2 className="text-5xl font-extrabold tracking-tight">Participa y <span style={{ color: branding.themeColor || '#3B82F6' }}>Gana</span></h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">Selecciona tu boleto de la suerte en nuestros sorteos activos y paga de forma 100% segura a través de nuestro sistema automatizado de WhatsApp.</p>
        </div>

        {/* Active Catalog Grid */}
        {(() => {
          const activeRaffles = raffles.filter(r => r.status === 'ACTIVE');
          const finishedRaffles = raffles.filter(r => r.status === 'FINISHED');

          return (
            <>
              {/* === SORTEOS ACTIVOS === */}
              {activeRaffles.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/30 rounded-2xl border border-gray-700/50 mb-16">
                  <p className="text-gray-400 text-lg">No hay sorteos activos en este momento. ¡Vuelve pronto!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
                  {activeRaffles.map((raffle) => (
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
                        {new Date(raffle.drawDate).toLocaleString('es-MX', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
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

          {/* === SORTEOS FINALIZADOS === */}
          {finishedRaffles.length > 0 && (
            <div className="mt-12 border-t border-gray-800 pt-16">
              <div className="text-center space-y-4 mb-12">
                <h2 className="text-4xl font-extrabold tracking-tight">Sorteos <span className="text-purple-400">Finalizados</span></h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">Conoce a nuestros afortunados ganadores y las evidencias de entrega. ¡Gracias por participar y confiar en nosotros!</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {finishedRaffles.map((raffle) => (
                  <div key={raffle.id} className="group bg-gray-800/50 rounded-2xl overflow-hidden border border-purple-500/30 flex flex-col relative opacity-90 hover:opacity-100 transition-opacity">
                    
                    {/* Badge Finalizado */}
                    <div className="absolute top-4 right-4 z-10 bg-purple-600/90 backdrop-blur text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                      Finalizado
                    </div>

                    {/* Evidencia o Imagen de Rifa */}
                    <div className="h-56 bg-gray-900 relative overflow-hidden flex items-center justify-center">
                      {raffle.evidenceUrl ? (
                        <img src={raffle.evidenceUrl.replace('http://localhost:3002/uploads', typeof window !== 'undefined' ? window.location.origin.replace('https://', 'https://api.') + '/api/uploads' : 'https://api.omnichat.radiotecpro.com/api/uploads')} alt="Evidencia de entrega" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : raffle.imageUrl ? (
                        <img src={raffle.imageUrl} alt={raffle.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                      ) : (
                        <span className="text-5xl opacity-50">🏆</span>
                      )}
                      
                      {/* Overlay ganador */}
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
                      
                      {raffle.winningNumber && (
                        <div className="absolute bottom-4 left-4 right-4 bg-purple-900/80 backdrop-blur-md border border-purple-500/50 rounded-xl p-3 flex justify-between items-center shadow-2xl">
                          <div>
                            <p className="text-[10px] text-purple-300 font-bold uppercase tracking-widest">Boleto Ganador</p>
                            <p className="text-3xl font-black text-white drop-shadow-md">#{raffle.winningNumber}</p>
                          </div>
                          <div className="text-4xl">🎉</div>
                        </div>
                      )}
                    </div>

                    <div className="p-6 flex flex-col flex-grow bg-gradient-to-b from-gray-800/50 to-gray-900">
                      <h3 className="text-xl font-bold mb-3 text-gray-200">{raffle.name}</h3>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-3 italic">"Premio entregado exitosamente. ¡Felicidades al ganador!"</p>
                      
                      {raffle.drawDate && (
                        <div className="mt-auto flex items-center gap-2 text-gray-500 text-xs font-medium bg-gray-800/80 w-fit px-3 py-2 rounded-lg border border-gray-700">
                          <Calendar className="w-4 h-4" /> Realizado el: {new Date(raffle.drawDate).toLocaleDateString('es-MX', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
        );
      })()}
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
