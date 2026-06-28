import { create } from 'zustand'
import type { Persona } from '@shared/types'
import { unwrap } from '@/lib/ipc'

interface AppState {
  personas: Persona[]
  selectedPersonaId: number | null
  loadingPersonas: boolean
  loadPersonas: () => Promise<void>
  selectPersona: (id: number | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  personas: [],
  selectedPersonaId: null,
  loadingPersonas: false,
  loadPersonas: async () => {
    set({ loadingPersonas: true })
    try {
      const personas = await unwrap(window.api.persona.list())
      const cur = get().selectedPersonaId
      const stillValid = cur != null && personas.some((p) => p.id === cur)
      set({
        personas,
        selectedPersonaId: stillValid ? cur : (personas[0]?.id ?? null)
      })
    } finally {
      set({ loadingPersonas: false })
    }
  },
  selectPersona: (id) => set({ selectedPersonaId: id })
}))
