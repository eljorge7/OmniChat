"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { KanbanBoard } from "./components/KanbanBoard";
import { Building2, Layers, X, SendHorizontal, Phone, Clock, PanelRight, Users, Ticket, Wrench, Search } from "lucide-react";
import { io } from "socket.io-client";

export default function PipelinePage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const fetchData = async () => {
    const activeCid = localStorage.getItem('activeCompanyId');
    const qParams = activeCid ? `?companyId=${activeCid}` : '';
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox${qParams}`);
      setDepartments(res.data.departments || []);
      setChats(res.data.chats || []);
      
      if (res.data.departments?.length > 0 && !activeDepartmentId) {
        setActiveDepartmentId(res.data.departments[0].id);
        if (res.data.departments[0].pipelines?.length > 0) {
          setActivePipelineId(res.data.departments[0].pipelines[0].id);
        }
      }
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = io(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}`);
    socket.on("newMessage", fetchData);
    socket.on("contactRouted", fetchData);

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleChatMove = async (contactId: any, newStageId: any) => {
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/contacts/stage`, {
        contactId,
        pipelineStageId: newStageId
      });
    } catch (e) {
      console.error("Error moving contact:", e);
      fetchData(); // Rollback on error
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedChatId) return;
    const text = replyText;
    setReplyText("");
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/send`, { contactId: selectedChatId, text });
      fetchData();
    } catch (e) {
      console.error("Send error:", e);
    }
  };

  const activeDepartment = departments.find((d: any) => d.id === activeDepartmentId);
  const activePipeline = activeDepartment?.pipelines?.find((p: any) => p.id === activePipelineId);
  const stages = activePipeline?.stages || [];
  
  // Filtrar chats que pertenecen a la pipeline activa
  const visibleChats = chats.filter((c: any) => c.pipeId === activePipelineId);
  const selectedChat = chats.find((c: any) => c.id === selectedChatId);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center bg-slate-50">Cargando Tablero Visual...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 relative overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Tablero Kanban</h1>
            <p className="text-sm text-slate-500 font-medium">Gestiona tu proceso de ventas y atención visualmente.</p>
          </div>
        </div>

        {/* Selectores de Departamento y Embudo */}
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            value={activeDepartmentId || ''}
            onChange={(e) => {
              const deptId = e.target.value;
              setActiveDepartmentId(deptId);
              const dept = departments.find(d => d.id === deptId);
              if (dept?.pipelines?.length > 0) {
                setActivePipelineId(dept.pipelines[0].id);
              }
            }}
          >
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {activeDepartment?.pipelines?.length > 0 && (
            <select 
              className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
              value={activePipelineId || ''}
              onChange={(e) => setActivePipelineId(e.target.value)}
            >
              {activeDepartment.pipelines.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Main Kanban Area */}
      <div className="flex-1 min-h-0 flex relative">
        <div className={`flex-1 flex flex-col min-w-0 transition-all ${selectedChatId ? 'mr-96' : ''}`}>
           {stages.length > 0 ? (
             <KanbanBoard 
                stages={stages} 
                initialChats={visibleChats} 
                onChatMove={handleChatMove} 
                onChatClick={setSelectedChatId}
             />
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center opacity-50">
                <Wrench className="w-16 h-16 text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-600">Embudo sin etapas</h2>
                <p className="text-slate-400 text-sm mt-2">Configura etapas en la base de datos para usar el tablero Kanban.</p>
             </div>
           )}
        </div>

        {/* Side Panel for Chat */}
        {selectedChatId && selectedChat && (
          <div className="absolute top-0 right-0 bottom-0 w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col z-20 animate-in slide-in-from-right duration-200">
            {/* Side Panel Header */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-4 bg-slate-50 shrink-0">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-100 text-indigo-700 font-black flex items-center justify-center rounded-full uppercase">
                    {selectedChat.name?.substring(0,2) || 'CL'}
                 </div>
                 <div>
                   <h3 className="font-bold text-slate-800 leading-tight">{selectedChat.name || selectedChat.phone}</h3>
                   <span className="text-[10px] font-bold text-emerald-500">EN LÍNEA</span>
                 </div>
               </div>
               <button onClick={() => setSelectedChatId(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                 <X className="w-5 h-5" />
               </button>
            </div>

            {/* Side Panel Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
               {selectedChat.messages?.map((msg: any) => (
                  <div key={msg.id} className={`flex max-w-[85%] flex-col ${msg.fromMe ? 'ml-auto items-end' : 'items-start'}`}>
                    <div className={`p-3 rounded-2xl text-sm shadow-sm ${msg.fromMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 rounded-tl-sm text-slate-700'}`}>
                       {msg.body}
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}
                    </span>
                  </div>
               ))}
            </div>

            {/* Side Panel Input */}
            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
               <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                 <input 
                   type="text" 
                   value={replyText}
                   onChange={e => setReplyText(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                   placeholder="Responder rápido..."
                   className="flex-1 bg-transparent border-none text-sm outline-none px-3"
                 />
                 <button 
                   onClick={handleSendReply}
                   disabled={!replyText.trim()}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                 >
                   <SendHorizontal className="w-4 h-4" />
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
