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
}

interface EventsState {
  events: Event[];
  updateEventStatus: (id: string, status: string, photoUris?: string[], comments?: string) => void;
}

export const useEventsStore = create<EventsState>((set) => ({
  events: [
    {
      id: '1',
      title: 'Mantenimiento Preventivo',
      description: 'Revisión y limpieza del equipo central.',
      startTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
      endTime: new Date(new Date().setHours(11, 30, 0, 0)).toISOString(),
      location: 'Av. Reforma 222, CDMX',
      status: 'PROGRAMADO'
    },
    {
      id: '2',
      title: 'Instalación de Fibra Óptica',
      description: 'Instalación nueva en el piso 5.',
      startTime: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
      endTime: new Date(new Date().setHours(17, 0, 0, 0)).toISOString(),
      location: 'Insurgentes Sur 105, CDMX',
      status: 'EN_CAMINO'
    }
  ],
  updateEventStatus: (id, status, photoUris, comments) => set((state) => ({
    events: state.events.map(e => e.id === id ? { ...e, status, photoUris, comments } : e)
  }))
}));
