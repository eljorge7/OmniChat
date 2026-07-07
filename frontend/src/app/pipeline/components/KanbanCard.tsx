import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, MessageCircle, Phone } from 'lucide-react';

export function KanbanCard({ chat, onClick }) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: chat.id,
    data: {
      type: 'Chat',
      chat,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-indigo-50 border-2 border-indigo-400 border-dashed rounded-xl p-4 h-28 opacity-50"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-grab active:cursor-grabbing group"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2 pointer-events-none">
        <h4 className="font-bold text-slate-800 text-sm truncate pr-2">{chat.name || chat.phone}</h4>
        {chat.unread > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shrink-0 shadow-sm">
            {chat.unread}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 line-clamp-2 mb-3 h-8 pointer-events-none">
        {chat.lastMessage}
      </p>

      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-2 mt-1 pointer-events-none">
        <div className="flex items-center gap-1">
          <Phone className="w-3 h-3" />
          <span>{chat.phone.replace('@c.us', '')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{chat.time ? new Date(chat.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
      </div>
    </div>
  );
}
