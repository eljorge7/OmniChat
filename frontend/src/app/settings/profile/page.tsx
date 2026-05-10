"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import axios from "axios";
import { User, Lock, Save, Camera } from "lucide-react";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session?.user) {
       setName(session.user.name || "");
       // Si hubiera avatarUrl en la sesión lo pondríamos aquí también.
    }
  }, [session]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    setSaving(true);
    try {
       await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/users/me`, {
         email: session.user.email,
         name,
         password: password || undefined,
         avatarUrl: avatarUrl || undefined
       }, {
         headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }
       });

       // Trigger next-auth re-fetch (solo actualizará name y email si el provider confía, 
       // pero para ver cambios completos puede requerir volver a loguear si NextAuth usa JWT mudo)
       await update({ name });
       
       alert("✅ Perfil actualizado correctamente. (Si cambiaste tu contraseña o el nombre, es posible que necesites cerrar sesión y volver a entrar para ver los cambios absolutos).");
       setPassword("");
    } catch (e) {
       alert("❌ Error actualizando el perfil");
    } finally {
       setSaving(false);
    }
  };

  const initials = name ? name.substring(0, 2).toUpperCase() : "US";

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
          Mi Perfil <User className="h-8 w-8 text-indigo-500" />
        </h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">Gestiona tu identidad visual, datos de acceso y tu rol dentro del ecosistema OmniChat.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="bg-indigo-600 h-32 w-full relative">
            <div className="absolute -bottom-12 left-8">
               <div className="h-24 w-24 bg-white rounded-2xl shadow-lg border-4 border-white flex items-center justify-center overflow-hidden relative group">
                  {avatarUrl ? (
                     <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                     <div className="bg-indigo-100 w-full h-full flex items-center justify-center text-3xl font-black text-indigo-500">
                       {initials}
                     </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                     <Camera className="text-white h-6 w-6" />
                  </div>
               </div>
            </div>
         </div>
         
         <form onSubmit={handleSave} className="pt-16 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               
               <div className="space-y-6">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nombre Completo</label>
                    <div className="relative">
                       <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                       <input 
                         type="text" 
                         value={name}
                         onChange={e => setName(e.target.value)}
                         className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                       />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Correo Electrónico (Solo Lectura)</label>
                    <input 
                      type="text" 
                      disabled
                      value={session?.user?.email || ""}
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-medium"
                    />
                 </div>
               </div>

               <div className="space-y-6">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">URL del Avatar (Opcional)</label>
                    <input 
                      type="url" 
                      value={avatarUrl}
                      onChange={e => setAvatarUrl(e.target.value)}
                      placeholder="https://imgur.com/...png"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                    />
                    <p className="text-xs text-slate-400 mt-2 font-medium">Puedes usar enlaces de imágenes públicas para personalizar tu avatar en el espacio de trabajo.</p>
                 </div>

                 <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <label className="block text-sm font-bold text-amber-900 flex items-center gap-2 mb-2">
                      <Lock className="h-4 w-4" /> Cambiar Contraseña
                    </label>
                    <input 
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Deja en blanco para no modificar"
                      className="w-full px-4 py-2.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm mb-2"
                    />
                    <p className="text-xs text-amber-700 font-medium">Si cambias tu contraseña deberás volver a iniciar sesión.</p>
                 </div>

                 <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mt-6">
                    <label className="block text-sm font-bold text-blue-900 flex items-center gap-2 mb-2">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Integración Google Workspace
                    </label>
                    <p className="text-xs text-blue-700 font-medium mb-4">Sincroniza tus contactos de WhatsApp con Google Contacts y agenda citas directamente en tu Google Calendar.</p>
                    <button 
                      type="button"
                      onClick={() => {
                         if ((session?.user as any)?.id) {
                            window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/google/auth?userId=${(session.user as any).id}`;
                         }
                      }}
                      className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-300 px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-sm w-full"
                    >
                      Conectar con Google
                    </button>
                 </div>
               </div>

            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
               <button 
                 disabled={saving}
                 type="submit" 
                 className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
               >
                 <Save className="h-5 w-5" />
                 {saving ? "Guardando cambios..." : "Guardar Perfil"}
               </button>
            </div>
         </form>
      </div>
    </div>
  );
}
