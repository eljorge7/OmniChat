"use client";

import { MessageCircle, Phone, Clock, Search, Filter, MoreVertical, Paperclip, SendHorizontal, Bot, Tag, StickyNote, X, User, ChevronLeft, PanelRight, PencilLine, CalendarDays, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useSession } from "next-auth/react";

export default function InboxPage() {
  const { data: session } = useSession();
  const [activePipeline, setActivePipeline] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState("");
  
  // Agent Assignment
  const [agents, setAgents] = useState<any[]>([]);
  const [viewFilter, setViewFilter] = useState<'all' | 'me'>('all');

  // Quick Replies System
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);

  // Mobile Responsiveness
  const [showCrmPanelMobile, setShowCrmPanelMobile] = useState(false);

  // Renaming Contacts
  const [isEditingHeaderName, setIsEditingHeaderName] = useState(false);
  const [isEditingCrmName, setIsEditingCrmName] = useState(false);
  const [editedName, setEditedName] = useState("");

  // Smart Scheduling
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ title: "", date: "", time: "10:00", location: "", pipelineId: "" });

  const currentChat = chats.find(c => c.id === selectedChatId) || chats.filter(c => c.pipeId === activePipeline)[0];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentChat) return;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("contactId", currentChat.id);

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox`);
      setChats(res.data.chats);
    } catch (err) {
      console.error("Error uploading file", err);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !currentChat) return;
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/contacts/notes`, { 
        contactId: currentChat.id, 
        text: newNote, 
        authorId: "Agente de Ventas"
      });
      setNewNote("");
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox`);
      setChats(res.data.chats);
    } catch (e) {
      console.error("Error saving note:", e);
    }
  };

  const handleUpdateTags = async (updatedTags: string[]) => {
    if (!currentChat) return;
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/contacts/tags`, {
        contactId: currentChat.id,
        tags: updatedTags
      });
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox`);
      setChats(res.data.chats);
    } catch (e) {
      console.error("Error updating tags:", e);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !currentChat) return;
    const contactId = currentChat.id;
    const text = replyText;
    setReplyText("");
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/send`, { contactId, text });
      const activeCid = localStorage.getItem('activeCompanyId');
      const qParams = activeCid ? `?companyId=${activeCid}` : '';
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox${qParams}`);
      setChats(res.data.chats);
    } catch (e) {
      console.error("Send error:", e);
    }
  };

  const handleRenameContact = async (source: 'header' | 'crm') => {
     if (!currentChat) return;
     
     if (source === 'header') setIsEditingHeaderName(false);
     if (source === 'crm') setIsEditingCrmName(false);

     if (editedName.trim() === "" || editedName === currentChat.name) return;
     
     try {
       await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/contacts/rename`, {
          contactId: currentChat.id,
          newName: editedName
       });
       const activeCid = localStorage.getItem('activeCompanyId');
       const qParams = activeCid ? `?companyId=${activeCid}` : '';
       const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox${qParams}`);
       setChats(res.data.chats);
     } catch(e) {
       console.error("Error renaming", e);
     }
  };

  const handleDeleteContact = async () => {
     if (!currentChat) return;
     if (!confirm(`¿Estás completamente seguro de borrar TODO el historial con ${currentChat.name || currentChat.phone}? Esta acción no se puede deshacer.`)) return;

     const activeCid = localStorage.getItem('activeCompanyId');
     if (!activeCid) return;

     try {
       await axios.delete(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/contacts/${activeCid}/${currentChat.id}`);
       // Trigger refresh
       const qParams = `?companyId=${activeCid}`;
       const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox${qParams}`);
       setChats(res.data.chats);
       setSelectedChatId(null);
     } catch(e) {
       console.error("Error deleting contact", e);
       alert("No se pudo eliminar la conversación.");
     }
  };

  const handleCreateSchedule = async () => {
     if(!currentChat || !scheduleData.title) return alert("Título y campos requeridos");
     const cid = localStorage.getItem('activeCompanyId') || '';
     const startObj = new Date(`${scheduleData.date}T${scheduleData.time}:00`);
     const endObj = new Date(startObj.getTime() + 60*60*1000); // +1h default
     
     try {
       await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/calendar/${cid}`, {
          title: scheduleData.title,
          description: `Cita auto-agendada desde el Inbox CRM.\nTeléfono: ${currentChat.phone}`,
          startTime: startObj.toISOString(),
          endTime: endObj.toISOString(),
          location: scheduleData.location,
          contactId: currentChat.id,
          pipelineId: scheduleData.pipelineId || currentChat.pipeId || null
       });
       setIsScheduleModalOpen(false);
       alert("🗓️ ¡Cita agendada correctamente!");
     } catch(e) {
       console.error("Error agendando", e);
       alert("Hubo un error agendando la cita");
     }
  };


  useEffect(() => {
    const activeCid = localStorage.getItem('activeCompanyId');
    const qParams = activeCid ? `?companyId=${activeCid}` : '';

    // 1. Fetch data from NextJS load
    axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox${qParams}`)
      .then(res => {
         const generalPipe = { id: null, name: "📥 Sin Asignar" };
         setPipelines([generalPipe, ...res.data.pipelines]);
         setChats(res.data.chats);
         setActivePipeline(null); // Entrar por defecto a la bandeja general
      })
      .catch(err => console.error("API Fetch Error:", err));

    // 1.b Fetch Quick Replies & Agents
    if (activeCid) {
       axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/quick-replies/${activeCid}`).then(qr => setQuickReplies(qr.data));
       axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/agents/${activeCid}`).then(ag => setAgents(ag.data));
    } else {
       // Fallback for first load if missing localStorage
       axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/v1/admin/companies`, { headers: { Authorization: "Bearer zohomasterkey_99_omnichat_x" }})
         .then(sys => {
           const compId = sys.data[0]?.id;
           if(compId) {
             axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/quick-replies/${compId}`).then(qr => setQuickReplies(qr.data));
             axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/agents/${compId}`).then(ag => setAgents(ag.data));
             localStorage.setItem('activeCompanyId', compId);
           }
         });
    }

    // 2. Open Sockets
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}`);

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("newMessage", () => {
      const activeCid = localStorage.getItem('activeCompanyId');
      const qParams = activeCid ? `?companyId=${activeCid}` : '';
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox${qParams}`).then(res => setChats(res.data.chats));
    });

    socket.on("contactRouted", () => {
      const activeCid = localStorage.getItem('activeCompanyId');
      const qParams = activeCid ? `?companyId=${activeCid}` : '';
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox${qParams}`).then(res => setChats(res.data.chats));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const assignChat = async (contactId: string, pipelineId: string) => {
    try {
       await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/assign`, { contactId, pipelineId });
       // No necesitamos modificar estado, el Socket disparará 'contactRouted' recargando la UI.
    } catch (e) {
       console.error("Error asignando:", e);
    }
  };

  const assignAgent = async (contactId: string, userId: string) => {
    try {
       await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/contacts/assign-agent`, { contactId, userId });
       axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox`).then(res => setChats(res.data.chats));
    } catch (e) {
       console.error("Error asignando agente:", e);
    }
  };

  const toggleBot = async (contactId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/bot/toggle`, { contactId, status: newStatus });
      axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox`).then(res => setChats(res.data.chats));
    } catch (e) {
      console.error("Bot toggle error:", e);
    }
  };

  const activeChats = chats.filter(c => 
    c.pipeId === activePipeline && 
    (!selectedTagFilter || c.tags?.includes(selectedTagFilter)) &&
    (viewFilter === 'all' || c.assignedTo?.id === (session?.user as any)?.id)
  );
  
  // Extraer todos los tags únicos entre los chats visibles en este embudo
  const uniqueTags = Array.from(new Set(chats.filter(c => c.pipeId === activePipeline).flatMap(c => c.tags || [])));

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Bandeja Compartida</h1>
            <p className="text-sm text-slate-500 font-medium">Gestiona todos los canales de WhatsApp de RJL en un solo lugar.</p>
          </div>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
          {pipelines.map((p) => (
            <button 
              key={p.id} 
              onClick={() => setActivePipeline(p.id)}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activePipeline === p.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden h-full relative">
        {/* Chat List (Kanban Column) */}
        <div className={`w-full md:w-80 bg-white border-r border-slate-200 flex-col shrink-0 ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-100 space-y-3">
             <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
               <button 
                 onClick={() => setViewFilter('all')}
                 className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${viewFilter === 'all' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Todos
               </button>
               <button 
                 onClick={() => setViewFilter('me')}
                 className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${viewFilter === 'me' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Mis Chats
               </button>
             </div>

             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Buscar chats o números..." 
                 className="w-full bg-slate-100 border-none rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
               />
             </div>
             
             {/* Tag Filter Dropdown */}
             {uniqueTags.length > 0 && (
               <div className="relative">
                 <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
                 <select
                   value={selectedTagFilter}
                   onChange={(e) => setSelectedTagFilter(e.target.value)}
                   className="w-full bg-indigo-50/50 border border-indigo-100 text-indigo-800 rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none cursor-pointer appearance-none hover:bg-indigo-50 transition"
                 >
                   <option value="">🎯 Todas las Etiquetas</option>
                   {uniqueTags.map((t: any) => (
                     <option key={t} value={t}>{t}</option>
                   ))}
                 </select>
               </div>
             )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeChats.map(chat => {
              const isActiveChat = currentChat?.id === chat.id;
              return (
              <div 
                key={chat.id} 
                onClick={() => setSelectedChatId(chat.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer group ${isActiveChat ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
                 <div className="flex justify-between items-start mb-1">
                   <h3 className={`font-bold text-sm ${isActiveChat ? 'text-indigo-900' : 'text-slate-800'}`}>{chat.name}</h3>
                   <span className="text-xs text-slate-400 font-medium">{chat.time}</span>
                 </div>
                 <p className="text-xs text-slate-500 truncate mb-2">{chat.lastMessage}</p>
                 <div className="flex items-center justify-between">
                   <div className="flex items-center text-xs text-slate-400 font-medium font-mono">
                     <Phone className="h-3 w-3 mr-1" /> {chat.phone}
                   </div>
                   {chat.unread > 0 && (
                     <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                       {chat.unread}
                     </span>
                   )}
                 </div>
              </div>
              );
            })}
            {activeChats.length === 0 && (
              <div className="text-center py-10 opacity-50">
                <Bot className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-bold text-slate-500">No hay chats asignados a este embudo.</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Chat Thread */}
        <div className={`flex-1 flex-col bg-slate-50/50 relative ${selectedChatId && !showCrmPanelMobile ? 'flex' : 'hidden md:flex'}`}>
          {activeChats.length > 0 ? (
            <>
              {/* Thread Header */}
              <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                  <button 
                    onClick={() => setSelectedChatId(null)} 
                    className="md:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold uppercase hidden sm:flex">
                    {currentChat?.name?.substring(0, 2)}
                  </div>
                  <div className="max-w-[130px] sm:max-w-xs md:max-w-md">
                    {isEditingHeaderName ? (
                      <input 
                        autoFocus
                        value={editedName}
                        onChange={e => setEditedName(e.target.value)}
                        onBlur={() => handleRenameContact('header')}
                        onKeyDown={e => e.key === 'Enter' && handleRenameContact('header')}
                        className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded outline-none border border-slate-300 w-full shadow-inner"
                      />
                    ) : (
                      <h2 
                         className="font-bold text-slate-800 truncate group cursor-pointer flex items-center gap-2 hover:text-indigo-600 transition-colors"
                         onClick={() => { setIsEditingHeaderName(true); setEditedName(currentChat?.name || "") }}
                         title="Clic para renombrar"
                      >
                         {currentChat?.name}
                         <PencilLine className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </h2>
                    )}
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">{currentChat?.phone} • <span className="text-emerald-500">En línea</span></p>
                  </div>
                </div>
                <div className="flex gap-1.5 sm:gap-3 items-center">
                  <select
                    value={currentChat?.pipeId || ''}
                    onChange={(e) => assignChat(currentChat?.id, e.target.value)}
                    className="bg-purple-50 border border-purple-100 rounded-lg text-sm font-bold text-purple-700 focus:ring-2 focus:ring-purple-500 py-1.5 pl-3 pr-8 cursor-pointer shadow-sm outline-none appearance-none"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=us-ascii,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1em 1em" }}
                  >
                    <option value="" disabled>🔀 Mover a Embudo</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>

                  <select 
                    value={currentChat?.assignedTo?.id || ''}
                    onChange={(e) => assignAgent(currentChat?.id, e.target.value)}
                    className="bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 py-1.5 pl-3 pr-8 cursor-pointer shadow-sm outline-none appearance-none hidden sm:block"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=us-ascii,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1em 1em" }}
                  >
                    <option value="" disabled>👤 Asignar Agente</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>

                  <button 
                    onClick={() => toggleBot(currentChat?.id, currentChat?.botStatus || 'ACTIVE')}
                    className={`hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm items-center gap-2 ${(!currentChat?.botStatus || currentChat?.botStatus === 'ACTIVE') ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300 border border-slate-300'}`}
                  >
                    {(!currentChat?.botStatus || currentChat?.botStatus === 'ACTIVE') ? (
                       <><Bot className="h-4 w-4" /> Piloto IA Activo</>
                    ) : (
                       <><Bot className="h-4 w-4 opacity-50" /> IA Pausada</>
                    )}
                  </button>

                  <button className="hidden sm:flex h-9 w-9 bg-slate-100 hover:bg-slate-200 rounded-lg items-center justify-center text-slate-600 transition-colors">
                    <Filter className="h-4 w-4" />
                  </button>
                  <button onClick={() => setShowCrmPanelMobile(!showCrmPanelMobile)} className="lg:hidden h-9 w-9 bg-slate-100 hover:bg-indigo-100 rounded-lg flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors">
                    <PanelRight className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={handleDeleteContact} 
                    title="Eliminar Conversación Permanentemente"
                    className="flex h-9 w-9 bg-red-50 hover:bg-red-100 rounded-lg items-center justify-center text-red-500 hover:text-red-700 transition-colors shadow-sm ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Thread Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {/* Auto-Bot Message */}
                 <div className="flex justify-center">
                   <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Ayer</span>
                 </div>
                 {currentChat?.messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex max-w-[75%] items-end gap-2 ${msg.fromMe ? 'ml-auto flex-row-reverse' : ''}`}>
                      <div className={`p-4 rounded-2xl shadow-sm relative group border ${msg.fromMe ? 'bg-indigo-600 text-white border-indigo-700 rounded-br-sm' : 'bg-white border-slate-200 rounded-bl-sm'}`}>
                         
                         {msg.mediaUrl && msg.mediaType?.startsWith('image/') && (
                            <img src={msg.mediaUrl} alt="WhatsApp Adjunto" className="max-w-full max-h-64 object-cover rounded-xl mb-3 shadow-md border border-white/20" />
                         )}
                         {msg.mediaUrl && msg.mediaType?.startsWith('audio/') && (
                            <audio controls src={msg.mediaUrl} className={`max-w-[260px] h-10 mb-3 rounded-full ${msg.fromMe ? 'opacity-90' : 'opacity-100'}`} />
                         )}
                         {msg.mediaUrl && !msg.mediaType?.startsWith('image/') && !msg.mediaType?.startsWith('audio/') && (
                            <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/10 px-4 py-3 rounded-xl mb-3 text-sm font-bold no-underline hover:bg-black/20 transition-all">
                              📎 Abrir Archivo
                            </a>
                         )}

                         <p className={`text-sm whitespace-pre-wrap ${msg.fromMe ? 'text-white/90' : 'text-slate-700'}`}>{msg.body}</p>
                      </div>
                    </div>
                 ))}
              </div>

              {/* Thread Input */}
              <div className="p-4 bg-white border-t border-slate-200 shrink-0 relative">
                
                {/* Slash Commands Hover Menu */}
                {showSlashMenu && quickReplies.length > 0 && (
                  <div className="absolute bottom-full left-4 bg-white w-80 mb-2 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-slate-200 overflow-hidden z-50">
                    <div className="bg-slate-50 p-2 border-b border-slate-100 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Respuestas Rápidas (Atajos)
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {quickReplies.filter(r => replyText.trim() === '/' || r.shortcut.includes(replyText.trim().replace('/', ''))).length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs font-bold">Sin coincidencias</div>
                      ) : quickReplies.filter(r => replyText.trim() === '/' || r.shortcut.includes(replyText.trim().replace('/', ''))).map(r => (
                        <button 
                          key={r.id}
                          onClick={() => { setReplyText(r.content); setShowSlashMenu(false); }}
                          className="w-full focus:outline-none text-left p-3 hover:bg-indigo-50 border-b border-slate-50 transition-colors last:border-0"
                        >
                          <div className="font-mono text-xs font-bold text-indigo-600 mb-1">{r.shortcut}</div>
                          <div className="text-xs text-slate-500 line-clamp-2">{r.content}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center bg-slate-100 p-2 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 transition-all border border-transparent focus-within:border-indigo-200 focus-within:bg-white relative">
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,audio/*,video/*,application/pdf" />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors rounded-lg">
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <input 
                    type="text" 
                    value={replyText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReplyText(val);
                      setShowSlashMenu(val.trim() === '/' || val.trim().startsWith('/'));
                    }}
                    onKeyDown={(e) => {
                      if(e.key === 'Enter') {
                        if (showSlashMenu) setShowSlashMenu(false); // Cancel menu if user insists on typing
                        else handleSendReply();
                      }
                    }}
                    placeholder="Escribe un mensaje en nombre de la empresa, o teclea '/' para atajos..." 
                    className="flex-1 bg-transparent border-none focus:outline-none px-4 text-sm text-slate-700 placeholder:text-slate-400"
                  />
                  <button 
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm font-bold text-sm ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Enviar</span>
                    <SendHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center opacity-50">
               <MessageCircle className="h-16 w-16 text-slate-300 mb-4" />
               <h2 className="text-xl font-bold text-slate-600">Selecciona un chat</h2>
               <p className="text-slate-400 text-sm mt-2">Los mensajes entrantes aparecerán aquí.</p>
             </div>
          )}
         </div>

        {/* Panel CRM (Notas y Etiquetas) */}
        {currentChat && (
          <div className={`w-full md:w-80 bg-white border-l border-slate-200 flex-col shrink-0 overflow-y-auto ${showCrmPanelMobile ? 'flex absolute inset-0 z-50' : 'hidden lg:flex'}`}>
             
             {/* Header Responsivo Panel Dcho */}
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 md:bg-white lg:hidden">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <PanelRight className="w-4 h-4 text-indigo-500" /> CRM Cliente
                 </h3>
                 <button onClick={() => setShowCrmPanelMobile(false)} className="text-slate-500 bg-white shadow-sm p-1.5 rounded-full"><X className="w-5 h-5"/></button>
             </div>

             {/* Perfil del Cliente */}
             <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-500" /> Ficha Técnica
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nombre o Razón Social</label>
                    <div className="mt-1">
                      {isEditingCrmName ? (
                        <input 
                          autoFocus
                          value={editedName}
                          onChange={e => setEditedName(e.target.value)}
                          onBlur={() => handleRenameContact('crm')}
                          onKeyDown={e => e.key === 'Enter' && handleRenameContact('crm')}
                          className="font-bold text-slate-800 bg-indigo-50 px-2 py-1 rounded outline-none border border-indigo-200 w-full text-sm shadow-inner"
                          placeholder="Ej. Juan Pérez"
                        />
                      ) : (
                        <div className="flex items-center justify-between group">
                          <span className="font-bold text-slate-800 text-sm truncate pr-2" title={currentChat.name}>{currentChat.name}</span>
                          <button 
                            onClick={() => { setIsEditingCrmName(true); setEditedName(currentChat.name || "") }} 
                            className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="Editar Nombre"
                          >
                            <PencilLine className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">WhatsApp / Teléfono</label>
                    <div className="mt-1 font-mono font-medium text-slate-600 text-sm">
                      {currentChat.phone.replace('@c.us', '')}
                    </div>
                  </div>
                  
                  {/* Atajo de Calendario */}
                  <div className="mt-3">
                    <button 
                      onClick={() => {
                        setScheduleData({ ...scheduleData, pipelineId: currentChat.pipeId || "" });
                        setIsScheduleModalOpen(true);
                      }}
                      className="w-full bg-slate-800 hover:bg-black text-white p-3 rounded-xl shadow-md font-bold flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <CalendarDays className="w-4 h-4" /> Agendar Servicio / Cita
                    </button>
                    <p className="text-[10px] text-slate-400 font-medium text-center mt-2 px-2">Crea recordatorios de instalación, mantenimiento o fechas de cobro.</p>
                  </div>
                </div>
             </div>

             <div className="p-5 border-b border-slate-100">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="font-black text-slate-800 flex items-center gap-2">
                   <Tag className="h-5 w-5 text-indigo-500" /> Clasificación (Tags)
                 </h3>
                 <button onClick={() => setShowCrmPanelMobile(false)} className="lg:hidden p-1 bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800">
                   <X className="h-5 w-5" />
                 </button>
               </div>
               <div className="flex flex-wrap gap-2 mb-4">
                 {currentChat.tags?.map((t: string) => (
                   <span key={t} className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-indigo-100">
                     {t}
                     <button onClick={() => handleUpdateTags(currentChat.tags.filter((x: string) => x !== t))} className="hover:text-red-500 transition-colors ml-1">
                       <X className="h-3 w-3" />
                     </button>
                   </span>
                 ))}
                 {(!currentChat.tags || currentChat.tags.length === 0) && (
                   <div className="text-xs text-slate-400 font-medium">Sin etiquetas.</div>
                 )}
               </div>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={newTag} 
                   onChange={e => setNewTag(e.target.value)} 
                   onKeyDown={e => {
                     if (e.key === 'Enter' && newTag.trim()) {
                       handleUpdateTags([...(currentChat.tags || []), newTag.trim()]);
                       setNewTag("");
                     }
                   }}
                   placeholder="Ej: Venta Caliente" 
                   className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-xs px-3 py-2 outline-none focus:border-indigo-500"
                 />
                 <button 
                  onClick={() => {
                     if(newTag.trim()) {
                       handleUpdateTags([...(currentChat.tags || []), newTag.trim()]);
                       setNewTag("");
                     }
                  }} 
                  className="bg-indigo-600 text-white font-bold px-3 py-2 rounded-lg text-xs hover:bg-indigo-700 transition"
                 >
                   Fijar
                 </button>
               </div>
             </div>

             <div className="p-5 flex-1 flex flex-col bg-amber-50/30">
               <h3 className="font-black text-slate-800 flex items-center gap-2 mb-4">
                 <StickyNote className="h-5 w-5 text-amber-500" /> Notas de Equipo
               </h3>
               
               <div className="space-y-3 flex-1 overflow-y-auto mb-4 pr-1">
                 {currentChat.notes?.map((n: any) => (
                   <div key={n.id} className="bg-[#feffc3] p-3 rounded-lg border border-[#e8ea96] shadow-sm transform rotate-1 hover:rotate-0 transition-all">
                     <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap">{n.text}</p>
                     <div className="flex justify-between items-center mt-2 border-t border-[#e8ea96] pt-2">
                       <span className="text-[9px] font-bold text-slate-500 uppercase">{n.authorId}</span>
                       <span className="text-[9px] font-bold text-slate-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                     </div>
                   </div>
                 ))}
                 {(!currentChat.notes || currentChat.notes.length === 0) && (
                   <div className="text-xs text-amber-600/50 font-medium text-center py-4 border border-dashed border-amber-200 rounded-xl">
                      No hay notas internas todavía.
                   </div>
                 )}
               </div>

               <div className="flex flex-col gap-2 shrink-0">
                 <textarea 
                   placeholder="Nota interna invisible para el cliente..."
                   value={newNote}
                   onChange={e => setNewNote(e.target.value)}
                   className="w-full bg-[#ffffe6] border border-[#e8ea96] rounded-xl text-xs p-3 outline-none focus:ring-2 focus:ring-amber-300 resize-none h-24 text-slate-800 font-medium placeholder:text-amber-700/40"
                 />
                 <button 
                  onClick={handleAddNote}
                  className="w-full bg-amber-400 hover:bg-amber-500 text-amber-900 font-black py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                 >
                   <StickyNote className="h-4 w-4" /> Guardar Nota
                 </button>
               </div>
             </div>
          </div>
        )}
      </div>
      
      {/* Modal de Agendamiento Inteligente */}
      {isScheduleModalOpen && currentChat && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
              <h2 className="text-xl font-black">🗓️ Agendar para {currentChat.name}</h2>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                 <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Título del Servicio</label>
                 <input autoFocus type="text" className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej. Instalación RadioTec, Lavado de Sala..." value={scheduleData.title} onChange={e => setScheduleData({...scheduleData, title: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Fecha de Visita</label>
                   <input type="date" className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={scheduleData.date} onChange={e => setScheduleData({...scheduleData, date: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Hora (Aprox)</label>
                   <input type="time" className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={scheduleData.time} onChange={e => setScheduleData({...scheduleData, time: e.target.value})} />
                 </div>
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Ubicación / Link Google Maps</label>
                 <input type="text" className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej. Av. Universidad 123 o Link de Maps" value={scheduleData.location} onChange={e => setScheduleData({...scheduleData, location: e.target.value})} />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Clasificación / Color</label>
                 <select className="w-full border-slate-200 rounded-xl bg-slate-50 focus:bg-white p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={scheduleData.pipelineId} onChange={e => setScheduleData({...scheduleData, pipelineId: e.target.value})}>
                   <option value="">(Sin clasificar / Mixto)</option>
                   {pipelines.filter(p => p.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
               </div>
               <div className="pt-2">
                 <button onClick={handleCreateSchedule} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5">
                   Confirmar Agenda en Calendario Maestro
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
