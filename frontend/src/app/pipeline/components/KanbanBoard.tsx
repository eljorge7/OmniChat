import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
export function KanbanBoard({ stages, initialChats, onChatMove, onChatClick }: { stages: any[], initialChats: any[], onChatMove: any, onChatClick: any }) {
  const [chats, setChats] = useState(initialChats);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveAChat = active.data.current?.type === 'Chat';
    const isOverAChat = over.data.current?.type === 'Chat';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (!isActiveAChat) return;

    // Dropping a chat over another chat
    if (isActiveAChat && isOverAChat) {
      setChats((chats) => {
        const activeIndex = chats.findIndex((t) => t.id === activeId);
        const overIndex = chats.findIndex((t) => t.id === overId);

        if (chats[activeIndex].pipelineStageId !== chats[overIndex].pipelineStageId) {
          chats[activeIndex].pipelineStageId = chats[overIndex].pipelineStageId;
          onChatMove(activeId, chats[overIndex].pipelineStageId);
        }

        return arrayMove(chats, activeIndex, overIndex);
      });
    }

    // Dropping a chat over an empty column
    if (isActiveAChat && isOverAColumn) {
      setChats((chats) => {
        const activeIndex = chats.findIndex((t) => t.id === activeId);
        if (chats[activeIndex].pipelineStageId !== overId) {
          chats[activeIndex].pipelineStageId = overId;
          onChatMove(activeId, overId);
        }
        return [...chats];
      });
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveId(null);
  };

  const activeChat = activeId ? chats.find(c => c.id === activeId) : null;

  return (
    <div className="flex flex-1 overflow-x-auto p-4 gap-4 bg-slate-50 min-h-0 relative">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full items-start">
          {stages.map((stage) => (
            <KanbanColumn 
              key={stage.id} 
              stage={stage} 
              chats={chats.filter(c => c.pipelineStageId === stage.id)}
              onChatClick={onChatClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeChat ? <KanbanCard chat={activeChat} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
