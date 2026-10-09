import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Pencil, Plus, Save, UserPlus } from 'lucide-react'
import { Badge, EmptyState, ErrorState, Field, Loading, Notice, PageHeader } from '../components/ui'
import { api, json } from '../lib/api'
import { fullName, money, roleLabel } from '../lib/format'
import { useClinicServices, useMe, useMyClinic, useStaff } from '../lib/queries'
import { clinicSchema, serviceSchema, staffSchema, type ClinicValues, type ServiceValues, type StaffValues } from '../lib/schemas'
import type { ClinicRole, Service, StaffMember } from '../lib/types'

function StaffForm({ onDone }: { onDone: (email: string) => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors: e } } = useForm<StaffValues>({ resolver: zodResolver(staffSchema), defaultValues: { role: 'reception' } })
  const mutation = useMutation({ mutationFn: (v: StaffValues) => api<StaffMember>('/clinic/staff', json('POST', v)), onSuccess: async data => { await client.invalidateQueries({ queryKey: ['clinic', 'staff'] }); onDone(data.email) } })
  return <section className="panel form-panel" style={{ marginBottom: 24 }}><h2>Nuevo miembro del equipo</h2><p className="muted">Comparte la contraseña temporal en persona; se le pedirá cambiarla al ingresar.</p>
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))} style={{ marginTop: 16 }}>
      <Field id="first_name" label="Nombres" error={e.first_name?.message}><input id="first_name" {...register('first_name')} /></Field>
      <Field id="last_name" label="Apellidos" error={e.last_name?.message}><input id="last_name" {...register('last_name')} /></Field>
      <Field id="email" label="Correo" error={e.email?.message}><input id="email" type="email" autoComplete="off" {...register('email')} /></Field>
      <Field id="phone" label="Teléfono" error={e.phone?.message}><input id="phone" type="tel" {...register('phone')} /></Field>
      <Field id="role" label="Rol" error={e.role?.message}><select id="role" {...register('role')}><option value="reception">Recepción</option><option value="vet">Veterinario</option><option value="admin">Administrador de veterinaria</option></select></Field>
      <Field id="temporary_password" label="Contraseña temporal" hint="Mínimo 10 caracteres." error={e.temporary_password?.message}><input id="temporary_password" type="text" autoComplete="off" {...register('temporary_password')} /></Field>
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button className="button" disabled={mutation.isPending}><UserPlus size={17} />{mutation.isPending ? 'Creando…' : 'Crear cuenta'}</button></div>
    </form></section>
}

export function Team() {
  const me = useMe()
  const staff = useStaff()
  const client = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const mutation = useMutation({
    mutationFn: ({ user_id, role, is_active }: { user_id: number; role: ClinicRole; is_active: boolean }) => api(`/clinic/staff/${user_id}`, json('PATCH', { role, is_active })),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['clinic', 'staff'] }); setNotice('Cambios guardados.') },
  })
  return <><PageHeader eyebrow="PERSONAS Y PERMISOS" title="Equipo" description="Recepción gestiona la agenda; veterinarios registran atenciones; administradores además gestionan equipo y servicios." action={!adding && <button className="button" onClick={() => { setNotice(''); setAdding(true) }}><Plus size={18} />Añadir miembro</button>} />
    {notice && <Notice>{notice}</Notice>}{mutation.isError && <ErrorState error={mutation.error} />}
    {adding && <StaffForm onDone={email => { setAdding(false); setNotice(`Cuenta creada para ${email}.`) }} />}
    {staff.isPending ? <Loading /> : staff.isError ? <ErrorState error={staff.error} retry={() => void staff.refetch()} /> : <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
      {staff.data.map(s => { const self = s.user_id === me.data?.id; return <tr key={s.user_id}>
        <td><strong>{fullName(s.profile)}</strong><small>{s.profile.phone}</small></td><td>{s.email}</td>
        <td>{self ? roleLabel[s.role] : <select aria-label={`Rol de ${fullName(s.profile)}`} value={s.role} disabled={mutation.isPending} onChange={e => mutation.mutate({ user_id: s.user_id, role: e.target.value as ClinicRole, is_active: s.is_active })}><option value="reception">Recepción</option><option value="vet">Veterinario</option><option value="admin">Administrador</option></select>}</td>
        <td><Badge status={s.is_active ? 'Activa' : 'Inactivo'} /></td>
        <td className="actions">{self ? <span className="muted">Tú</span> : <button className="text-link" disabled={mutation.isPending} onClick={() => mutation.mutate({ user_id: s.user_id, role: s.role, is_active: !s.is_active })}>{s.is_active ? 'Desactivar' : 'Reactivar'}</button>}</td>
      </tr> })}</tbody></table></div>}
  </>
}

function ServiceForm({ service, onDone }: { service?: Service; onDone: () => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors: e } } = useForm<ServiceValues>({ resolver: zodResolver(serviceSchema), defaultValues: service ?? { is_active: true } })
  const mutation = useMutation({ mutationFn: (v: ServiceValues) => api(service ? `/clinic/services/${service.id}` : '/clinic/services', json(service ? 'PUT' : 'POST', v)), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['clinic', 'services'] }); await client.invalidateQueries({ queryKey: ['services'] }); onDone() } })
  return <section className="panel form-panel" style={{ marginBottom: 24 }}><h2>{service ? `Editar ${service.name}` : 'Nuevo servicio'}</h2>
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))} style={{ marginTop: 16 }}>
      <Field id="name" label="Nombre" error={e.name?.message} full><input id="name" {...register('name')} /></Field>
      <Field id="description" label="Descripción" error={e.description?.message} full><textarea id="description" rows={3} {...register('description')} /></Field>
      <Field id="duration_minutes" label="Duración (minutos)" error={e.duration_minutes?.message}><input id="duration_minutes" type="number" min={5} max={600} {...register('duration_minutes')} /></Field>
      <Field id="price" label="Precio referencial (S/)" error={e.price?.message}><input id="price" type="number" min={0} step="0.01" {...register('price')} /></Field>
      <label className="check full"><input type="checkbox" {...register('is_active')} />Visible para propietarios</label>
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button type="button" className="button secondary" onClick={onDone}>Cancelar</button><button className="button" disabled={mutation.isPending}><Save size={17} />Guardar</button></div>
    </form></section>
}

export function Services() {
  const services = useClinicServices()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  return <><PageHeader eyebrow="CATÁLOGO" title="Servicios" description="Los servicios retirados dejan de mostrarse, pero se conservan en citas anteriores." action={!editing && <button className="button" onClick={() => setEditing('new')}><Plus size={18} />Nuevo servicio</button>} />
    {editing && <ServiceForm key={editing === 'new' ? 'new' : editing.id} service={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
    {services.isPending ? <Loading /> : services.isError ? <ErrorState error={services.error} retry={() => void services.refetch()} /> : !services.data.length ? <div className="panel"><EmptyState title="Sin servicios">Publica tu primer servicio para recibir solicitudes.</EmptyState></div>
      : <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Servicio</th><th>Duración</th><th>Precio</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{services.data.map(s => <tr key={s.id}>
        <td><strong>{s.name}</strong><small>{s.description}</small></td><td>{s.duration_minutes} min</td><td>{money(s.price)}</td><td><Badge status={s.is_active ? 'Activa' : 'Inactivo'} /></td>
        <td className="actions"><button className="text-link" onClick={() => setEditing(s)}><Pencil size={15} /> Editar</button></td></tr>)}</tbody></table></div>}
  </>
}

export function ClinicSettings() {
  const clinic = useMyClinic()
  const client = useQueryClient()
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, formState: { errors: e, isDirty }, reset } = useForm<ClinicValues>({ resolver: zodResolver(clinicSchema), values: clinic.data })
  const mutation = useMutation({ mutationFn: (v: ClinicValues) => api<ClinicValues>('/clinic', json('PUT', v)), onSuccess: async data => { reset(data); setSaved(true); await client.invalidateQueries({ queryKey: ['clinic'] }); await client.invalidateQueries({ queryKey: ['me'] }) } })
  if (clinic.isPending) return <Loading />
  if (clinic.isError) return <ErrorState error={clinic.error} retry={() => void clinic.refetch()} />
  return <><PageHeader eyebrow="PERFIL PÚBLICO" title="Datos de la veterinaria" description="Así te ven los propietarios en el catálogo." />
    <section className="panel form-panel">{saved && <Notice>Datos actualizados.</Notice>}
      <form className="form-grid" noValidate onSubmit={handleSubmit(v => { setSaved(false); mutation.mutate(v) })}>
        <Field id="name" label="Nombre comercial" error={e.name?.message} full><input id="name" {...register('name')} /></Field>
        <Field id="address" label="Dirección" error={e.address?.message} full><input id="address" {...register('address')} /></Field>
        <Field id="phone" label="Teléfono" error={e.phone?.message}><input id="phone" type="tel" {...register('phone')} /></Field>
        <Field id="opening_hours" label="Horario de atención" error={e.opening_hours?.message}><input id="opening_hours" {...register('opening_hours')} /></Field>
        <Field id="description" label="Descripción" error={e.description?.message} full><textarea id="description" rows={4} {...register('description')} /></Field>
        {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
        <div className="form-actions full"><button className="button" disabled={mutation.isPending || !isDirty}><Save size={17} />Guardar cambios</button></div>
      </form></section></>
}
