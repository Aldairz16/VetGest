import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarCheck, CalendarClock, CalendarDays, Check, ClipboardPlus, Clock3, Phone, Save, UserX, X } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Back, Badge, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Notice, PageHeader, PetIcon } from '../components/ui'
import { api, json } from '../lib/api'
import { dateTime, fullName, limaParts, timeOnly } from '../lib/format'
import { useAgenda, useClinicAppointment, useClinicSummary, useMe, useStaff, type AgendaFilter } from '../lib/queries'
import { can } from '../lib/roles'
import { todayLima } from '../lib/schemas'
import type { AppointmentStatus, ClinicAppointment } from '../lib/types'

const STATUSES: AppointmentStatus[] = ['Pendiente', 'Confirmada', 'Atendida', 'Cancelada', 'No asistió']

function AgendaTable({ items, showDate = true }: { items: ClinicAppointment[]; showDate?: boolean }) {
  return <div className="panel table-wrap"><table className="data-table"><thead><tr><th>{showDate ? 'Fecha y hora' : 'Hora'}</th><th>Paciente</th><th>Propietario</th><th>Servicio</th><th>Veterinario</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
    <tbody>{items.map(a => <tr key={a.id}>
      <td>{showDate ? dateTime(a.starts_at) : timeOnly(a.starts_at)}</td>
      <td><strong>{a.pet.name}</strong><small>{a.pet.species} · {a.pet.breed}</small></td>
      <td>{fullName(a.owner)}<small>{a.owner.phone}</small></td>
      <td>{a.service.name}</td>
      <td>{a.vet ? fullName(a.vet.profile) : <span className="muted">Por asignar</span>}</td>
      <td><Badge status={a.status} /></td>
      <td className="actions"><Link className="text-link" to={`/clinica/agenda/${a.id}`}>Gestionar <ArrowRight size={15} /></Link></td>
    </tr>)}</tbody></table></div>
}

export function ClinicHome() {
  const me = useMe()
  const user = me.data
  const isVet = can(user, 'vet')
  const today = todayLima()
  const summary = useClinicSummary()
  const agenda = useAgenda({ date_from: today, date_to: today, mine: isVet })
  if (summary.isPending || agenda.isPending) return <Loading />
  if (summary.isError || agenda.isError) return <ErrorState error={summary.error ?? agenda.error} retry={() => { void summary.refetch(); void agenda.refetch() }} />
  const t = summary.data.today
  const active = agenda.data.filter(a => a.status !== 'Cancelada')
  return <><PageHeader eyebrow={user?.membership?.clinic_name.toUpperCase()} title={`Hola, ${user?.profile.first_name ?? ''}`} description={isVet ? 'Tus pacientes de hoy y su historial, en un solo lugar.' : 'La agenda de hoy y las solicitudes que esperan respuesta.'} action={<Link className="button" to="/clinica/agenda"><CalendarDays size={18} />Ver agenda</Link>} />
    <div className="stats-grid">
      <article className="stat-card"><span className="stat-icon amber"><CalendarClock /></span><div><span>Solicitudes por confirmar</span><strong>{String(summary.data.pending_requests).padStart(2, '0')}</strong></div><Link to="/clinica/agenda?estado=Pendiente" aria-label="Ver solicitudes pendientes"><ArrowRight size={20} /></Link></article>
      <article className="stat-card"><span className="stat-icon teal"><CalendarCheck /></span><div><span>Confirmadas hoy</span><strong>{String(t.Confirmada ?? 0).padStart(2, '0')}</strong></div></article>
      <article className="stat-card"><span className="stat-icon teal"><Check /></span><div><span>{isVet ? 'Tus citas confirmadas hoy' : 'Atendidas hoy'}</span><strong>{String(isVet ? summary.data.my_today : t.Atendida ?? 0).padStart(2, '0')}</strong></div></article>
    </div>
    <div className="section-heading" style={{ padding: '8px 0 14px', border: 0 }}><h2>{isVet ? 'Tus citas de hoy' : 'Agenda de hoy'}</h2></div>
    {active.length ? <AgendaTable items={active} showDate={false} /> : <div className="panel"><EmptyState title="No hay citas para hoy">{isVet ? 'Cuando recepción te asigne una cita, aparecerá aquí.' : 'Las solicitudes nuevas aparecerán en la agenda.'}</EmptyState></div>}
  </>
}

export function Agenda() {
  const me = useMe()
  const [params] = useSearchParams()
  const initialStatus = params.get('estado') ?? ''
  const [filter, setFilter] = useState<AgendaFilter>({ date_from: initialStatus ? '' : todayLima(), date_to: '', status: initialStatus, mine: can(me.data, 'vet') })
  const agenda = useAgenda(filter)
  const set = (patch: Partial<AgendaFilter>) => setFilter(f => ({ ...f, ...patch }))
  return <><PageHeader eyebrow="ORGANIZA LA ATENCIÓN" title="Agenda" description="Confirma solicitudes, asigna veterinarios y da seguimiento a cada cita." />
    <div className="toolbar">
      <Field id="date_from" label="Desde"><input id="date_from" type="date" value={filter.date_from} onChange={e => set({ date_from: e.target.value })} /></Field>
      <Field id="date_to" label="Hasta"><input id="date_to" type="date" value={filter.date_to} onChange={e => set({ date_to: e.target.value })} /></Field>
      <Field id="status" label="Estado"><select id="status" value={filter.status} onChange={e => set({ status: e.target.value })}><option value="">Todos</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
      {can(me.data, 'vet', 'admin') && <label className="check"><input type="checkbox" checked={!!filter.mine} onChange={e => set({ mine: e.target.checked })} />Solo mis citas</label>}
    </div>
    {agenda.isPending ? <Loading /> : agenda.isError ? <ErrorState error={agenda.error} retry={() => void agenda.refetch()} /> : agenda.data.length ? <AgendaTable items={agenda.data} /> : <div className="panel"><EmptyState title="No hay citas con estos filtros">Prueba con otro rango de fechas o estado.</EmptyState></div>}
  </>
}

export function ClinicAppointmentDetail() {
  const { id } = useParams()
  const me = useMe()
  const appointment = useClinicAppointment(id)
  const staff = useStaff()
  const client = useQueryClient()
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<'Cancelada' | 'No asistió' | null>(null)
  const [vetId, setVetId] = useState<string>()
  const [when, setWhen] = useState<{ date: string; time: string }>()
  const [notes, setNotes] = useState<string>()
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<ClinicAppointment>(`/clinic/appointments/${id}`, json('PATCH', body)),
    onSuccess: async (data, body) => {
      client.setQueryData(['clinic', 'appointments', 'detail', id], data)
      await client.invalidateQueries({ queryKey: ['clinic'] })
      setConfirm(null); setWhen(undefined)
      setNotice(body.status === 'Confirmada' ? 'Cita confirmada.' : body.status ? `La cita quedó como «${data.status}».` : body.starts_at ? 'Cita reprogramada.' : 'Cambios guardados.')
    },
  })
  if (appointment.isPending) return <Loading />
  if (appointment.isError) return <ErrorState error={appointment.error} retry={() => void appointment.refetch()} />
  const a = appointment.data
  const frontDesk = can(me.data, 'admin', 'reception')
  const clinician = can(me.data, 'admin', 'vet')
  const open = a.status === 'Pendiente' || a.status === 'Confirmada'
  const vets = staff.data?.filter(s => s.is_active && (s.role === 'vet' || s.role === 'admin')) ?? []
  const selectedVet = vetId ?? (a.vet ? String(a.vet.id) : '')
  const schedule = when ?? limaParts(a.starts_at)
  const staffNotes = notes ?? a.staff_notes
  const run = (body: Record<string, unknown>) => { setNotice(''); mutation.mutate(body) }
  return <><Back to="/clinica/agenda">Agenda</Back><PageHeader title={`${a.service.name} · ${a.pet.name}`} description={`Cita #${String(a.id).padStart(4, '0')} · solicitada el ${dateTime(a.created_at)}`} action={<Badge status={a.status} />} />
    {notice && <Notice>{notice}</Notice>}{mutation.isError && !confirm && <ErrorState error={mutation.error} />}
    <div className="booking-layout"><section className="panel appointment-detail">
      <div className="appointment-detail-title"><span className="pet-avatar"><PetIcon species={a.pet.species} size={38} /></span><div><p className="eyebrow">PACIENTE</p><h2>{a.pet.name}</h2><p className="muted">{a.pet.species} · {a.pet.breed} · {a.pet.sex} · {a.pet.weight} kg</p></div></div>
      <div className="appointment-location"><p><CalendarDays size={21} /><strong>{dateTime(a.starts_at)} · Lima</strong></p><p><Clock3 size={21} /><span>{a.service.duration_minutes} minutos</span></p><p><Phone size={21} /><span>{fullName(a.owner)}<small>{a.owner.phone}</small></span></p></div>
      <div className="notes-section"><h3>Motivo indicado por el propietario</h3><p>{a.reason || 'Sin comentario.'}</p></div>
      {a.pet.notes && <div className="notes-section"><h3>Observaciones de la mascota</h3><p>{a.pet.notes}</p></div>}
      <div className="appointment-detail-footer"><p>Revisa antecedentes antes de atender.</p><div className="inline-actions"><Link className="button secondary" to={`/clinica/pacientes/${a.pet.id}`}>Ver historial</Link>{clinician && open && <Link className="button" to={`/clinica/pacientes/${a.pet.id}?cita=${a.id}`}><ClipboardPlus size={17} />Registrar atención</Link>}</div></div>
    </section>
    <aside className="stack">
      {frontDesk && open && <section className="panel form-panel"><h2>Gestionar cita</h2>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <Field id="vet" label="Veterinario" full><select id="vet" value={selectedVet} onChange={e => setVetId(e.target.value)}><option value="">Por asignar</option>{vets.map(v => <option key={v.user_id} value={v.user_id}>{fullName(v.profile)}</option>)}</select></Field>
          {a.status === 'Pendiente' ? <button className="button full" disabled={mutation.isPending} onClick={() => run({ status: 'Confirmada', vet_id: selectedVet ? Number(selectedVet) : null })}><Check size={17} />Confirmar cita</button>
            : <button className="button secondary full" disabled={mutation.isPending || selectedVet === (a.vet ? String(a.vet.id) : '')} onClick={() => run({ vet_id: selectedVet ? Number(selectedVet) : null })}><Save size={17} />Guardar veterinario</button>}
          <h3 className="sub full">Reprogramar</h3>
          <Field id="new_date" label="Fecha"><input id="new_date" type="date" min={todayLima()} value={schedule.date} onChange={e => setWhen({ ...schedule, date: e.target.value })} /></Field>
          <Field id="new_time" label="Hora (Lima)"><input id="new_time" type="time" value={schedule.time} onChange={e => setWhen({ ...schedule, time: e.target.value })} /></Field>
          <button className="button secondary full" disabled={mutation.isPending || !when} onClick={() => run({ starts_at: `${schedule.date}T${schedule.time}:00-05:00` })}><CalendarClock size={17} />Guardar nuevo horario</button>
          <div className="inline-actions full" style={{ justifyContent: 'space-between' }}>
            <button className="button secondary danger-text" disabled={mutation.isPending} onClick={() => { mutation.reset(); setConfirm('Cancelada') }}><X size={17} />Cancelar cita</button>
            {a.status === 'Confirmada' && new Date(a.starts_at).getTime() < Date.now() && <button className="button secondary" disabled={mutation.isPending} onClick={() => { mutation.reset(); setConfirm('No asistió') }}><UserX size={17} />No asistió</button>}
          </div>
        </div></section>}
      {frontDesk && <section className="panel form-panel"><h2>Notas internas</h2><p className="muted">Solo las ve el equipo de la veterinaria.</p>
        <div className="form-grid" style={{ marginTop: 12 }}><Field id="staff_notes" label="Notas" full><textarea id="staff_notes" rows={4} maxLength={2000} value={staffNotes} onChange={e => setNotes(e.target.value)} /></Field>
          <div className="form-actions full"><button className="button secondary" disabled={mutation.isPending || notes === undefined || notes === a.staff_notes} onClick={() => run({ staff_notes: staffNotes })}><Save size={17} />Guardar notas</button></div></div></section>}
      {!frontDesk && a.staff_notes && <section className="panel form-panel"><h2>Notas internas</h2><p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{a.staff_notes}</p></section>}
    </aside></div>
    <ConfirmDialog open={!!confirm} title={confirm === 'Cancelada' ? `¿Cancelar la cita de ${a.pet.name}?` : `¿Marcar que ${a.pet.name} no asistió?`} confirmLabel={confirm === 'Cancelada' ? 'Sí, cancelar' : 'Sí, marcar inasistencia'} pending={mutation.isPending} onCancel={() => setConfirm(null)} onConfirm={() => run({ status: confirm })} error={mutation.error}><p>{confirm === 'Cancelada' ? 'El propietario verá la cita como cancelada. Te recomendamos avisarle por teléfono.' : 'La cita quedará registrada como inasistencia.'}</p></ConfirmDialog>
  </>
}
