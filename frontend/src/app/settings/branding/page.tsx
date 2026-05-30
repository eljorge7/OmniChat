"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import axios from "axios";
import { Palette, Image as ImageIcon, Save, Loader2, Upload } from "lucide-react";

export default function BrandingPage() {
  const { data: session } = useSession();
  const [logoUrl, setLogoUrl] = useState("");
  const [themeColor, setThemeColor] = useState("#3B82F6");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if ((session?.user as any)?.companyId) {
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/companies/${(session!.user as any).companyId}/public`)
        .then(res => {
          if (res.data) {
            setLogoUrl(res.data.logoUrl || "");
            setThemeColor(res.data.themeColor || "#3B82F6");
          }
        })
        .catch(err => console.error("Error loading company branding:", err))
        .finally(() => setLoading(false));
    }
  }, [session]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("contactId", "branding"); // fake contactId to pass validation if needed

    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/companies/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data && res.data.mediaUrl) {
        setLogoUrl(res.data.mediaUrl);
      } else {
        alert("No se recibió la URL de la imagen");
      }
    } catch (err) {
      console.error(err);
      alert("Error subiendo la imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    setSaving(true);
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/companies/me`, {
        email: session.user.email,
        logoUrl,
        themeColor
      }, {
        headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }
      });

      alert("✅ Configuración de marca guardada correctamente. Estos cambios se reflejarán en tu página pública de sorteos.");
    } catch (err) {
      console.error(err);
      alert("❌ Error actualizando la marca");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 max-w-4xl mx-auto flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
          Marca y Diseño <Palette className="h-8 w-8 text-indigo-500" />
        </h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">Personaliza la identidad visual de tu portal público de sorteos (Logotipo y Color Principal).</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 p-8 flex items-center justify-center border-b border-slate-800 relative" style={{ backgroundColor: '#0B1120' }}>
          <div className="w-full max-w-lg">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-4 text-center">Vista Previa del Encabezado</p>
            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 flex items-center justify-between">
              <div className="flex items-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-12 object-contain" />
                ) : (
                  <span className="text-2xl font-black text-white tracking-wider uppercase drop-shadow-md bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, ${themeColor}, #10B981)` }}>
                    TU EMPRESA
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: themeColor }}></span>
                Plataforma Segura
              </div>
            </div>
            
            <div className="mt-6">
              <button 
                className="w-full py-4 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
                style={{ backgroundColor: themeColor }}
              >
                Botón de Ejemplo
              </button>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Logotipo de la Empresa</label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="text-slate-400 w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm cursor-pointer inline-flex items-center gap-2 transition-colors">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? "Subiendo..." : "Subir Imagen"}
                      <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                    <p className="text-xs text-slate-500 mt-2">Recomendado: PNG con fondo transparente.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">O URL del Logotipo</label>
                <input 
                  type="url" 
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Color del Tema (Primario)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="color" 
                    value={themeColor}
                    onChange={e => setThemeColor(e.target.value)}
                    className="w-14 h-14 rounded-xl cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={themeColor}
                    onChange={e => setThemeColor(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 uppercase"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Este color se usará en botones, bordes y acentos visuales.</p>
              </div>
              
              <div className="flex gap-2 flex-wrap mt-2">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setThemeColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${themeColor.toLowerCase() === color.toLowerCase() ? 'border-slate-900 scale-110' : 'border-transparent'} transition-transform`}
                    style={{ backgroundColor: color }}
                  />
                ))}
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
              {saving ? "Guardando..." : "Guardar Diseño"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
