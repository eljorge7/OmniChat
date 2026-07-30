import { create } from 'zustand';

export interface Event {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  status: string;
  photoUris?: string[];
  comments?: string;
  photoEvidence?: string;
}

interface EventsState {
  events: Event[];
  setEvents: (events: Event[]) => void;
  updateEventStatus: (id: string, status: string, photoUris?: string[], comments?: string) => void;
}

export const useEventsStore = create<EventsState>((set) => ({
  events: [],
  setEvents: (events) => set({ events }),
  updateEventStatus: (id, status, photoUris, comments) => set((state) => ({
    events: state.events.map(e => e.id === id ? { ...e, status, photoUris, comments } : e)
  }))
}));
