"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, ShieldAlert, Mail, KeyRound, Briefcase, Trash2 } from "lucide-react";
import axios from "axios";
import { useSession } from "next-auth/react";

export default function TeamSettings() {
  const { data: session } = useSession();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("AGENT");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const sys = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/v1/admin/companies`, { headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }});
      const compId = sys.data[0]?.id;
      if (!compId) return;

      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/agents/${compId}`);
      setAgents(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!email || !password || !name) return;

    setIsSaving(true);
    try {
      const sys = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/v1/admin/companies`, { headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }});
      const compId = sys.data[0]?.id;

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}"}/api/inbox/agents/create`, {
        companyId: compId,
        name,
        email,
        password,
        role
      });

      setName("");
      setEmail("");
      setPassword("");
      setRole("AGENT");
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message || "Error agregando empleado");
    } finally {
      setIsSaving(false);
    }
  };

  if ((session?.user as any)?.role !== 'ADMIN') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <ShieldAlert className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Acceso Restringido</h2>
          <p className="text-slate-500 max-w-sm mt-2">Solo los Coordinadores y Propietarios pueden modificar la plantilla del equipo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pt-10 px-6">
      <div className="flex items-center gap-4 mb-8">
         <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
           <Users className="h-8 w-8" />
         </div>
         <div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestión de Equipo (Ventas)</h1>
           <p className="text-slate-500 font-medium">Invita asesores, restringe sus permisos de sistema y audita sus métricas.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Formulario de Empleado */}
        <div className="md:col-span-1">
           <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
             <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
               <UserPlus className="h-5 w-5 text-indigo-500" /> Nuevo Integrante
             </h2>
             
             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre Completo</label>
                 <div className="relative">
                   <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                   <input 
                     type="text" 
                     value={name}
                     onChange={e => setName(e.target.value)}
                     placeholder="Ej. Monse Gómez" 
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Correo Corporativo</label>
                 <div className="relative">
                   <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                   <input 
                     type="email" 
                     value={email}
                     onChange={e => setEmail(e.target.value.toLowerCase())}
                     placeholder="monse@empresa.com" 
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Asignar Contraseña</label>
                 <div className="relative">
                   <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                   <input 
                     type="password" 
                     value={password}
                     onChange={e => setPassword(e.target.value)}
                     placeholder="******" 
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nivel de Acceso (RBAC)</label>
                 <select 
                   value={role}
                   onChange={e => setRole(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                 >
                   <option value="AGENT">Asesor Ventas (Básico)</option>
                   <option value="ADMIN">Coordinador (Acceso Total)</option>
                 </select>
               </div>

               <button 
                type="submit" 
                disabled={isSaving || !email || !password || !name}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 mt-4"
               >
                 {isSaving ? 'Registrando...' : 'Dar de Alta'}
               </button>
             </div>
           </form>
        </div>

        {/* Listado de Empleados */}
        <div className="md:col-span-2 space-y-4">
           {loading ? (
             <div className="text-center p-10 text-slate-400 font-bold">Cargando nómina...</div>
           ) : agents.length === 0 ? (
             <div className="text-center p-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
               No hay empleados registrados en tu sucursal.
             </div>
           ) : (
             agents.map(agent => (
               <div key={agent.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-indigo-300 transition-colors">
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shadow-inner ${agent.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                   {agent.name.substring(0,2).toUpperCase()}
                 </div>
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                     <h3 className="font-bold text-slate-800 text-lg">{agent.name}</h3>
                     {agent.role === 'ADMIN' && (
                       <span className="bg-amber-100 text-amber-800 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black border border-amber-200">
                         Coordinador
                       </span>
                     )}
                     {agent.role === 'AGENT' && (
                       <span className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black border border-slate-200">
                         Asesor
                       </span>
                     )}
                   </div>
                   <p className="text-slate-500 font-medium text-sm flex items-center gap-1.5"><Mail className="h-4 w-4" /> {agent.email}</p>
                 </div>
                 
                 {/* Only another Admin could hypothetically delete, leaving UI placeholder */}
                 <button className="text-slate-300 hover:text-red-500 transition-colors p-2" title="Revocar Acceso">
                   <Trash2 className="h-5 w-5" />
                 </button>
               </div>
             ))
           )}
        </div>
      </div>
    </div>
  );
}
