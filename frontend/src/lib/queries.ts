import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from './api'
import type { AdminClinic, Appointment, Clinic, ClinicAppointment, ClinicSummary, History, Patient, Pet, PlatformSummary, Reminder, Service, StaffMember, User } from './types'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: async () => {
    try { return await api<User>('/auth/me') } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  }, staleTime: 60_000, retry: false })
}
export const usePets = () => useQuery({ queryKey: ['pets'], queryFn: () => api<Pet[]>('/pets') })
export const usePet = (id: string | undefined) => useQuery({ queryKey: ['pets', id], queryFn: () => api<Pet>(`/pets/${id}`), enabled: !!id })
export const useClinics = (search = '') => useQuery({ queryKey: ['clinics', search], queryFn: () => api<Clinic[]>(`/clinics?search=${encodeURIComponent(search)}`) })
export const useClinic = (id: string | undefined) => useQuery({ queryKey: ['clinics', 'detail', id], queryFn: () => api<Clinic>(`/clinics/${id}`), enabled: !!id })
export const useServices = (id: string | number | undefined) => useQuery({ queryKey: ['services', String(id)], queryFn: () => api<Service[]>(`/services?clinic_id=${id}`), enabled: !!id })
export const useAppointments = () => useQuery({ queryKey: ['appointments'], queryFn: () => api<Appointment[]>('/appointments') })
export const useAppointment = (id: string | undefined) => useQuery({ queryKey: ['appointments', id], queryFn: () => api<Appointment>(`/appointments/${id}`), enabled: !!id })
export const usePetHistory = (id: string | undefined) => useQuery({ queryKey: ['pets', id, 'history'], queryFn: () => api<History>(`/pets/${id}/history`), enabled: !!id })
export const useReminders = () => useQuery({ queryKey: ['reminders'], queryFn: () => api<Reminder[]>('/reminders') })

export interface AgendaFilter { date_from?: string; date_to?: string; status?: string; mine?: boolean }
const qs = (params: Record<string, string | boolean | undefined>) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== false).map(([k, v]) => [k, String(v)])).toString()
export const useMyClinic = () => useQuery({ queryKey: ['clinic'], queryFn: () => api<AdminClinic>('/clinic') })
export const useClinicSummary = () => useQuery({ queryKey: ['clinic', 'summary'], queryFn: () => api<ClinicSummary>('/clinic/summary') })
export const useAgenda = (filter: AgendaFilter) => useQuery({ queryKey: ['clinic', 'appointments', filter], queryFn: () => api<ClinicAppointment[]>(`/clinic/appointments?${qs({ ...filter })}`) })
export const useClinicAppointment = (id: string | undefined) => useQuery({ queryKey: ['clinic', 'appointments', 'detail', id], queryFn: () => api<ClinicAppointment>(`/clinic/appointments/${id}`), enabled: !!id })
export const usePatients = (search = '') => useQuery({ queryKey: ['clinic', 'patients', search], queryFn: () => api<Patient[]>(`/clinic/patients?${qs({ search })}`) })
export const usePatient = (id: string | undefined) => useQuery({ queryKey: ['clinic', 'patients', 'detail', id], queryFn: () => api<Patient>(`/clinic/patients/${id}`), enabled: !!id })
export const usePatientHistory = (id: string | undefined) => useQuery({ queryKey: ['clinic', 'patients', 'detail', id, 'history'], queryFn: () => api<History>(`/clinic/patients/${id}/history`), enabled: !!id })
export const useStaff = () => useQuery({ queryKey: ['clinic', 'staff'], queryFn: () => api<StaffMember[]>('/clinic/staff') })
export const useClinicServices = () => useQuery({ queryKey: ['clinic', 'services'], queryFn: () => api<Service[]>('/clinic/services') })
export const usePlatformSummary = () => useQuery({ queryKey: ['admin', 'summary'], queryFn: () => api<PlatformSummary>('/admin/summary') })
export const useAdminClinics = () => useQuery({ queryKey: ['admin', 'clinics'], queryFn: () => api<AdminClinic[]>('/admin/clinics') })
