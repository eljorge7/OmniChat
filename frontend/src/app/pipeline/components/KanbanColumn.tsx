import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanCard } from './KanbanCard';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export function KanbanColumn({ stage, chats, onChatClick }: { stage: any, chats: any[], onChatClick: any }) {
  const { setNodeRef } = useSortable({
    id: stage.id,
    data: {
      type: 'Column',
      stage,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="bg-slate-100 w-80 min-w-[320px] shrink-0 rounded-2xl p-3 flex flex-col h-full border border-slate-200/60 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="font-black text-slate-700 text-sm">{stage.name}</h3>
        <span className="bg-slate-200 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">
          {chats.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-2 flex flex-col">
        <SortableContext items={chats.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {chats.map(chat => (
            <KanbanCard key={chat.id} chat={chat} onClick={() => onChatClick(chat.id)} />
          ))}
        </SortableContext>
        
        {chats.length === 0 && (
           <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl m-1 opacity-50">
             <span className="text-slate-400 text-xs font-bold">Soltar aquí</span>
           </div>
        )}
      </div>
    </div>
  );
}
