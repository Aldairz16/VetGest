import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowRight, ClipboardPlus, Plus, Save, Search, Syringe, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { HistoryView } from '../components/History'
import { Back, EmptyState, ErrorState, Field, Loading, Notice, PageHeader, PetIcon } from '../components/ui'
import { api, json } from '../lib/api'
import { dateTime, fullName, longDate } from '../lib/format'
import { useClinicAppointment, useMe, usePatient, usePatientHistory, usePatients } from '../lib/queries'
import { can } from '../lib/roles'
import { careSchema, recordSchema, todayLima, type CareValues } from '../lib/schemas'

export function Patients() {
  const [search, setSearch] = useState('')
  const patients = usePatients(search)
  return <><PageHeader eyebrow="FICHAS CLÍNICAS" title="Pacientes" description="Mascotas que solicitaron cita o fueron atendidas en tu veterinaria." />
    <div className="catalog-toolbar"><div className="search-input"><Search size={20} /><label className="sr-only" htmlFor="patient-search">Buscar por mascota o propietario</label><input id="patient-search" type="search" placeholder="Buscar por mascota o propietario…" maxLength={80} value={search} onChange={e => setSearch(e.target.value)} /></div></div>
    {patients.isPending ? <Loading /> : patients.isError ? <ErrorState error={patients.error} retry={() => void patients.refetch()} /> : !patients.data.length ? <div className="panel"><EmptyState title={search ? 'Sin coincidencias' : 'Aún no hay pacientes'}>{search ? 'Prueba con otro nombre.' : 'Cuando un propietario solicite una cita en tu veterinaria, su mascota aparecerá aquí.'}</EmptyState></div>
      : <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Paciente</th><th>Especie y raza</th><th>Propietario</th><th>Teléfono</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{patients.data.map(p => <tr key={p.id}>
        <td><strong>{p.name}</strong><small>{p.sex} · {p.weight} kg</small></td><td>{p.species} · {p.breed}</td><td>{fullName(p.owner)}</td><td>{p.owner.phone}</td>
        <td className="actions"><Link className="text-link" to={`/clinica/pacientes/${p.id}`}>Ver ficha <ArrowRight size={15} /></Link></td></tr>)}</tbody></table></div>}
  </>
}

const recordFormSchema = recordSchema.extend({ care: z.array(careSchema).max(10) })
type RecordFormValues = z.infer<typeof recordFormSchema>
const emptyCare = (): CareValues => ({ kind: 'Vacuna', name: '', dose: '', applied_on: todayLima(), next_due_on: '', notes: '' })
const cleanCare = (c: CareValues) => ({ ...c, next_due_on: c.next_due_on || null })

function RecordForm({ petId, appointmentId, onSaved }: { petId: string; appointmentId?: string; onSaved: () => void }) {
  const client = useQueryClient()
  const appointment = useClinicAppointment(appointmentId)
  const { register, control, handleSubmit, formState: { errors } } = useForm<RecordFormValues>({
    resolver: zodResolver(recordFormSchema),
    defaultValues: { reason: '', diagnosis: '', indications: '', weight: '', next_visit_on: '', care: [] },
    values: appointment.data ? { reason: appointment.data.reason || appointment.data.service.name, diagnosis: '', indications: '', weight: '', next_visit_on: '', care: [] } : undefined,
    resetOptions: { keepDirtyValues: true },
  })
  const care = useFieldArray({ control, name: 'care' })
  const mutation = useMutation({
    mutationFn: (v: RecordFormValues) => api(`/clinic/patients/${petId}/records`, json('POST', {
      ...v, appointment_id: appointmentId ? Number(appointmentId) : null, weight: v.weight === '' ? null : v.weight,
      next_visit_on: v.next_visit_on || null, care: v.care.map(cleanCare),
    })),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['clinic'] }); onSaved() },
  })
  const e = errors
  return <section className="panel form-panel"><div className="form-section-title"><span className="stat-icon teal"><ClipboardPlus /></span><div><h2>Registrar atención</h2><p className="muted">{appointment.data ? `Cita del ${dateTime(appointment.data.starts_at)} · ${appointment.data.service.name}` : 'Atención sin cita previa.'} Quedará firmada con tu nombre y no podrá editarse.</p></div></div>
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))}>
      <Field id="reason" label="Motivo de consulta" error={e.reason?.message} full><input id="reason" aria-invalid={!!e.reason} {...register('reason')} /></Field>
      <Field id="diagnosis" label="Diagnóstico y hallazgos" error={e.diagnosis?.message} full><textarea id="diagnosis" rows={4} maxLength={4000} aria-invalid={!!e.diagnosis} {...register('diagnosis')} /></Field>
      <Field id="indications" label="Indicaciones / receta (opcional)" error={e.indications?.message} full><textarea id="indications" rows={3} maxLength={4000} {...register('indications')} /></Field>
      <Field id="weight" label="Peso actual en kg (opcional)" error={e.weight?.message}><input id="weight" type="number" inputMode="decimal" min="0.01" step="0.01" {...register('weight')} /></Field>
      <Field id="next_visit_on" label="Próximo control (opcional)" error={e.next_visit_on?.message}><input id="next_visit_on" type="date" min={todayLima()} {...register('next_visit_on')} /></Field>
      <h3 className="sub full">Vacunas, desparasitaciones o tratamientos aplicados</h3>
      {care.fields.map((f, i) => <div className="care-row full" key={f.id}>
        <Field id={`care-${i}-kind`} label="Tipo"><select id={`care-${i}-kind`} {...register(`care.${i}.kind`)}><option>Vacuna</option><option>Desparasitación</option><option>Tratamiento</option></select></Field>
        <Field id={`care-${i}-name`} label="Producto o vacuna" error={e.care?.[i]?.name?.message}><input id={`care-${i}-name`} {...register(`care.${i}.name`)} /></Field>
        <Field id={`care-${i}-dose`} label="Dosis (opcional)"><input id={`care-${i}-dose`} {...register(`care.${i}.dose`)} /></Field>
        <Field id={`care-${i}-applied`} label="Aplicada el" error={e.care?.[i]?.applied_on?.message}><input id={`care-${i}-applied`} type="date" max={todayLima()} {...register(`care.${i}.applied_on`)} /></Field>
        <Field id={`care-${i}-next`} label="Próxima dosis (genera recordatorio)" error={e.care?.[i]?.next_due_on?.message}><input id={`care-${i}-next`} type="date" {...register(`care.${i}.next_due_on`)} /></Field>
        <div className="field" style={{ justifyContent: 'flex-end' }}><button type="button" className="danger-link" onClick={() => care.remove(i)}><Trash2 size={16} />Quitar</button></div>
      </div>)}
      {care.fields.length < 10 && <div className="full"><button type="button" className="button secondary small" onClick={() => care.append(emptyCare())}><Plus size={16} />Añadir vacuna o tratamiento</button></div>}
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button className="button" disabled={mutation.isPending}><Save size={17} />{mutation.isPending ? 'Guardando…' : 'Guardar atención'}</button></div>
    </form></section>
}

function CareForm({ petId, onSaved }: { petId: string; onSaved: () => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors: e } } = useForm<CareValues>({ resolver: zodResolver(careSchema), defaultValues: emptyCare() })
  const mutation = useMutation({
    mutationFn: (v: CareValues) => api(`/clinic/patients/${petId}/care`, json('POST', cleanCare(v))),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['clinic', 'patients'] }); onSaved() },
  })
  return <section className="panel form-panel"><div className="form-section-title"><span className="stat-icon teal"><Syringe /></span><div><h2>Registrar vacuna o tratamiento</h2><p className="muted">Para aplicaciones rápidas sin consulta completa.</p></div></div>
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))}>
      <Field id="kind" label="Tipo" error={e.kind?.message}><select id="kind" {...register('kind')}><option>Vacuna</option><option>Desparasitación</option><option>Tratamiento</option></select></Field>
      <Field id="name" label="Producto o vacuna" error={e.name?.message}><input id="name" aria-invalid={!!e.name} {...register('name')} /></Field>
      <Field id="dose" label="Dosis (opcional)"><input id="dose" {...register('dose')} /></Field>
      <Field id="applied_on" label="Aplicada el" error={e.applied_on?.message}><input id="applied_on" type="date" max={todayLima()} {...register('applied_on')} /></Field>
      <Field id="next_due_on" label="Próxima dosis (opcional)" error={e.next_due_on?.message}><input id="next_due_on" type="date" {...register('next_due_on')} /></Field>
      <Field id="notes" label="Notas (opcional)" full><textarea id="notes" rows={2} maxLength={2000} {...register('notes')} /></Field>
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button className="button" disabled={mutation.isPending}><Save size={17} />{mutation.isPending ? 'Guardando…' : 'Guardar'}</button></div>
    </form></section>
}

export function PatientDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const appointmentId = params.get('cita') ?? undefined
  const me = useMe()
  const patient = usePatient(id)
  const history = usePatientHistory(id)
  const navigate = useNavigate()
  const [mode, setMode] = useState<'record' | 'care' | null>(appointmentId ? 'record' : null)
  const [notice, setNotice] = useState('')
  if (patient.isPending) return <Loading />
  if (patient.isError) return <ErrorState error={patient.error} retry={() => void patient.refetch()} />
  const p = patient.data
  const clinician = can(me.data, 'admin', 'vet')
  const saved = (message: string) => { setMode(null); setNotice(message); if (appointmentId) navigate(`/clinica/pacientes/${id}`, { replace: true }) }
  return <><Back to="/clinica/pacientes">Pacientes</Back>
    <PageHeader title={p.name} description={`${p.species} · ${p.breed} · ${p.sex}`} action={clinician && !mode && <div className="inline-actions"><button className="button secondary" onClick={() => { setNotice(''); setMode('care') }}><Syringe size={17} />Vacuna o tratamiento</button><button className="button" onClick={() => { setNotice(''); setMode('record') }}><ClipboardPlus size={17} />Registrar atención</button></div>} />
    {notice && <Notice>{notice}</Notice>}
    <div className="pet-detail-layout"><aside className="panel pet-identity"><span className="pet-avatar huge"><PetIcon species={p.species} size={86} /></span><h2>{p.name}</h2><p>{p.species} · {p.breed}</p><span className="badge owner-badge">{p.sex}</span></aside>
      <section className="panel detail-panel"><h2>Ficha</h2><dl className="detail-grid">{[['Nacimiento aproximado', longDate(p.birth_date)], ['Peso', `${p.weight} kg`], ['Color', p.color], ['Propietario', fullName(p.owner)], ['Teléfono', p.owner.phone]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="notes-section"><h3>Observaciones del propietario</h3><p>{p.notes || 'Sin observaciones.'}</p></div></section></div>
    {mode && <div style={{ marginTop: 24 }}>{mode === 'record' ? <RecordForm petId={String(p.id)} appointmentId={appointmentId} onSaved={() => saved('Atención registrada en el historial.')} /> : <CareForm petId={String(p.id)} onSaved={() => saved('Registro guardado en la cartilla.')} />}<p style={{ marginTop: 10 }}><button className="text-link" onClick={() => setMode(null)}>Cancelar registro</button></p></div>}
    <div className="section-heading" style={{ padding: '30px 0 14px', border: 0 }}><h2>Historial clínico</h2><span className="muted">Todas las veterinarias</span></div>
    <HistoryView history={history} petName={p.name} />
  </>
}
