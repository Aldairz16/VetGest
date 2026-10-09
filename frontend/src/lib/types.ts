export interface Profile { first_name: string; last_name: string; phone: string }
export type Role = 'owner' | 'staff' | 'platform_admin'
export type ClinicRole = 'admin' | 'vet' | 'reception'
export interface Membership { clinic_id: number; clinic_name: string; role: ClinicRole }
export interface User { id: number; email: string; role: Role; must_change_password: boolean; profile: Profile; membership: Membership | null }
export interface Pet {
  id: number; name: string; species: 'Perro' | 'Gato' | 'Ave' | 'Conejo' | 'Otro';
  breed: string; sex: 'Macho' | 'Hembra'; birth_date: string; weight: number;
  color: string; notes: string; created_at: string; updated_at: string;
}
export interface Clinic {
  id: number; name: string; address: string; phone: string;
  opening_hours: string; description: string;
}
export interface Service {
  id: number; clinic_id: number; name: string; description: string;
  duration_minutes: number; price: number; is_active: boolean;
}
export type AppointmentStatus = 'Pendiente' | 'Confirmada' | 'Atendida' | 'Cancelada' | 'No asistió'
export interface StaffName { id: number; profile: Profile }
export interface Appointment {
  id: number; pet: Pet; clinic: Clinic; service: Service;
  starts_at: string; reason: string; status: AppointmentStatus;
  vet: StaffName | null; has_record: boolean;
  created_at: string; updated_at: string;
}
export interface ClinicAppointment extends Appointment { owner: Profile; staff_notes: string }
export interface Patient extends Pet { owner: Profile }
export type CareKind = 'Vacuna' | 'Desparasitación' | 'Tratamiento'
export interface CareEvent {
  id: number; kind: CareKind; name: string; dose: string; applied_on: string;
  next_due_on: string | null; notes: string; clinic: { id: number; name: string }; vet: StaffName;
}
export interface MedicalRecord {
  id: number; pet_id: number; appointment_id: number | null; attended_at: string;
  reason: string; diagnosis: string; indications: string; weight: number | null;
  next_visit_on: string | null; clinic: { id: number; name: string }; vet: StaffName;
}
export interface History { records: MedicalRecord[]; care: CareEvent[] }
export interface Reminder {
  kind: CareKind | 'Control' | 'Cita'; title: string; pet_id: number; pet_name: string;
  due: string; overdue: boolean; clinic_name: string;
}
export interface StaffMember { user_id: number; email: string; role: ClinicRole; is_active: boolean; profile: Profile }
export interface AdminClinic extends Clinic { is_active: boolean; staff_count: number; appointment_count: number }
export interface ClinicSummary { today: Partial<Record<AppointmentStatus, number>>; pending_requests: number; my_today: number }
export interface PlatformSummary { owners: number; staff: number; pets: number; active_clinics: number; appointments_30d: Partial<Record<AppointmentStatus, number>> }
