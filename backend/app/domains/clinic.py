"""Clinic workspace for staff: agenda, patients, clinical records, team and services."""

from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.security import ClinicAdmin, Clinician, Db, FrontDesk, Staff, password_hash
from app.domains.appointments import appointment_options
from app.domains.history import pet_history
from app.models import (
    Appointment,
    CareEvent,
    ClinicMember,
    MedicalRecord,
    Pet,
    Profile,
    User,
    VeterinaryClinic,
    VeterinaryService,
)
from app.schemas import (
    AdminClinicOut,
    AppointmentManage,
    CareInput,
    CareOut,
    ClinicAppointmentOut,
    ClinicInput,
    HistoryOut,
    PatientOut,
    RecordInput,
    RecordOut,
    ServiceInput,
    ServiceOut,
    StaffInput,
    StaffOut,
    StaffUpdate,
)

router = APIRouter(prefix="/clinic", tags=["Clínica"])
LIMA = ZoneInfo("America/Lima")
# Allowed front-desk transitions. "Atendida" is only reached by registering a clinical record.
TRANSITIONS = {
    "Pendiente": {"Confirmada", "Cancelada"},
    "Confirmada": {"Cancelada", "No asistió"},
}


def clinic_appointment(db, member: ClinicMember, appointment_id: int, lock: bool = False) -> Appointment:
    query = select(Appointment).where(Appointment.id == appointment_id, Appointment.clinic_id == member.clinic_id) \
        .options(*appointment_options(), selectinload(Appointment.owner))
    appointment = db.scalar(query.with_for_update(of=Appointment) if lock else query)
    if not appointment:
        raise HTTPException(404, "No encontramos esa cita en tu clínica.")
    return appointment


def related_to_clinic(clinic_id: int):
    """A clinic may access a pet once the owner booked with it or it attended the pet."""
    return or_(
        exists().where(Appointment.pet_id == Pet.id, Appointment.clinic_id == clinic_id),
        exists().where(MedicalRecord.pet_id == Pet.id, MedicalRecord.clinic_id == clinic_id),
    )


def clinic_patient(db, member: ClinicMember, pet_id: int) -> Pet:
    pet = db.scalar(select(Pet).where(Pet.id == pet_id, related_to_clinic(member.clinic_id))
                    .options(selectinload(Pet.owner)))
    if not pet:
        raise HTTPException(404, "Esta mascota no es paciente de tu clínica.")
    return pet


def clinic_vet(db, member: ClinicMember, vet_id: int) -> ClinicMember:
    vet = db.scalar(select(ClinicMember).join(User).where(
        ClinicMember.user_id == vet_id, ClinicMember.clinic_id == member.clinic_id,
        ClinicMember.role.in_(("vet", "admin")), User.is_active.is_(True)))
    if not vet:
        raise HTTPException(422, "Selecciona un veterinario activo de tu clínica.")
    return vet


# ---- Clinic profile -------------------------------------------------------------------------

@router.get("", response_model=AdminClinicOut)
def my_clinic(member: Staff, db: Db):
    return db.get(VeterinaryClinic, member.clinic_id)


@router.put("", response_model=AdminClinicOut)
def update_clinic(data: ClinicInput, member: ClinicAdmin, db: Db):
    clinic = db.get(VeterinaryClinic, member.clinic_id)
    for key, value in data.model_dump().items():
        setattr(clinic, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe otra veterinaria con ese nombre.") from None
    return clinic


@router.get("/summary")
def summary(member: Staff, db: Db):
    today = datetime.now(LIMA).date()
    start = datetime.combine(today, time.min, LIMA)
    rows = db.execute(select(Appointment.status, func.count()).where(
        Appointment.clinic_id == member.clinic_id, Appointment.starts_at >= start,
        Appointment.starts_at < start + timedelta(days=1)).group_by(Appointment.status)).all()
    pending = db.scalar(select(func.count()).where(Appointment.clinic_id == member.clinic_id,
                                                   Appointment.status == "Pendiente", Appointment.starts_at >= datetime.now(UTC)))
    mine = 0
    if member.role in ("vet", "admin"):
        mine = db.scalar(select(func.count()).where(
            Appointment.vet_id == member.user_id, Appointment.status == "Confirmada",
            Appointment.starts_at >= start, Appointment.starts_at < start + timedelta(days=1)))
    return {"today": dict(rows), "pending_requests": pending, "my_today": mine}


# ---- Agenda ---------------------------------------------------------------------------------

@router.get("/appointments", response_model=list[ClinicAppointmentOut])
def list_clinic_appointments(member: Staff, db: Db, date_from: date | None = None, date_to: date | None = None,
                             status: str | None = Query(default=None, max_length=12), mine: bool = False):
    query = select(Appointment).where(Appointment.clinic_id == member.clinic_id) \
        .options(*appointment_options(), selectinload(Appointment.owner))
    if date_from:
        query = query.where(Appointment.starts_at >= datetime.combine(date_from, time.min, LIMA))
    if date_to:
        query = query.where(Appointment.starts_at < datetime.combine(date_to + timedelta(days=1), time.min, LIMA))
    if status:
        query = query.where(Appointment.status == status)
    if mine:
        query = query.where(Appointment.vet_id == member.user_id)
    return db.scalars(query.order_by(Appointment.starts_at).limit(500)).all()


@router.get("/appointments/{appointment_id}", response_model=ClinicAppointmentOut)
def get_clinic_appointment(appointment_id: int, member: Staff, db: Db):
    return clinic_appointment(db, member, appointment_id)


@router.patch("/appointments/{appointment_id}", response_model=ClinicAppointmentOut)
def manage_appointment(appointment_id: int, data: AppointmentManage, member: FrontDesk, db: Db):
    appointment = clinic_appointment(db, member, appointment_id, lock=True)
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "No indicaste ningún cambio.")
    editable = appointment.status in TRANSITIONS
    if ("vet_id" in changes or "starts_at" in changes) and not editable:
        raise HTTPException(409, f"La cita está {appointment.status.lower()} y ya no se puede modificar.")
    if changes.get("vet_id") is not None:
        appointment.vet_id = clinic_vet(db, member, changes["vet_id"]).user_id
    elif "vet_id" in changes:
        appointment.vet_id = None
    if changes.get("starts_at") is not None:
        if data.starts_at <= datetime.now(UTC):
            raise HTTPException(422, "Elige una fecha y hora futuras.")
        appointment.starts_at = data.starts_at
    if changes.get("staff_notes") is not None:
        appointment.staff_notes = data.staff_notes
    if changes.get("status") is not None and data.status != appointment.status:
        if data.status not in TRANSITIONS.get(appointment.status, set()):
            raise HTTPException(409, f"No se puede pasar de {appointment.status} a {data.status}.")
        if data.status == "No asistió" and appointment.starts_at > datetime.now(UTC):
            raise HTTPException(409, "Solo puedes marcar inasistencia después de la hora de la cita.")
        appointment.status = data.status
    db.commit()
    db.expire(appointment)  # reload relationships such as the newly assigned vet
    return clinic_appointment(db, member, appointment_id)


# ---- Patients and clinical history -----------------------------------------------------------

@router.get("/patients", response_model=list[PatientOut])
def list_patients(member: Staff, db: Db, search: str = Query(default="", max_length=80)):
    query = select(Pet).join(Profile, Profile.id == Pet.owner_id).where(related_to_clinic(member.clinic_id)) \
        .options(selectinload(Pet.owner))
    term = search.strip()
    if term:
        query = query.where(or_(Pet.name.icontains(term, autoescape=True),
                                Profile.first_name.icontains(term, autoescape=True),
                                Profile.last_name.icontains(term, autoescape=True)))
    return db.scalars(query.order_by(Pet.name).limit(200)).all()


@router.get("/patients/{pet_id}", response_model=PatientOut)
def get_patient(pet_id: int, member: Staff, db: Db):
    return clinic_patient(db, member, pet_id)


@router.get("/patients/{pet_id}/history", response_model=HistoryOut)
def get_patient_history(pet_id: int, member: Staff, db: Db):
    return pet_history(db, clinic_patient(db, member, pet_id).id)


def add_care(db, member: ClinicMember, pet: Pet, data: CareInput, record_id: int | None = None) -> CareEvent:
    event = CareEvent(pet_id=pet.id, clinic_id=member.clinic_id, vet_id=member.user_id, record_id=record_id,
                      **data.model_dump())
    db.add(event)
    return event


@router.post("/patients/{pet_id}/records", response_model=RecordOut, status_code=201)
def create_record(pet_id: int, data: RecordInput, member: Clinician, db: Db):
    pet = clinic_patient(db, member, pet_id)
    if pet.deleted_at:
        raise HTTPException(409, "El propietario retiró a esta mascota; no se pueden registrar nuevas atenciones.")
    appointment = None
    if data.appointment_id:
        appointment = clinic_appointment(db, member, data.appointment_id, lock=True)
        if appointment.pet_id != pet.id:
            raise HTTPException(422, "La cita no corresponde a esta mascota.")
        if appointment.status not in ("Pendiente", "Confirmada") or appointment.record:
            raise HTTPException(409, "Esta cita ya fue atendida, cancelada o marcada como inasistencia.")
    record = MedicalRecord(pet_id=pet.id, clinic_id=member.clinic_id, vet_id=member.user_id,
                           appointment_id=data.appointment_id, attended_at=datetime.now(UTC),
                           **data.model_dump(exclude={"appointment_id", "care"}))
    db.add(record)
    db.flush()
    for item in data.care:
        add_care(db, member, pet, item, record.id)
    if appointment:
        appointment.status = "Atendida"
        appointment.vet_id = member.user_id
    if data.weight:
        pet.weight = Decimal(str(data.weight))
    db.commit()
    return db.scalar(select(MedicalRecord).where(MedicalRecord.id == record.id).options(
        selectinload(MedicalRecord.clinic), selectinload(MedicalRecord.vet).selectinload(User.profile)))


@router.post("/patients/{pet_id}/care", response_model=CareOut, status_code=201)
def create_care(pet_id: int, data: CareInput, member: Clinician, db: Db):
    pet = clinic_patient(db, member, pet_id)
    if pet.deleted_at:
        raise HTTPException(409, "El propietario retiró a esta mascota; no se pueden registrar nuevos cuidados.")
    event = add_care(db, member, pet, data)
    db.commit()
    return db.scalar(select(CareEvent).where(CareEvent.id == event.id).options(
        selectinload(CareEvent.clinic), selectinload(CareEvent.vet).selectinload(User.profile)))


# ---- Team -----------------------------------------------------------------------------------

def staff_query(clinic_id: int):
    return select(ClinicMember).where(ClinicMember.clinic_id == clinic_id) \
        .options(selectinload(ClinicMember.user).selectinload(User.profile))


@router.get("/staff", response_model=list[StaffOut])
def list_staff(member: Staff, db: Db):
    return db.scalars(staff_query(member.clinic_id).order_by(ClinicMember.role, ClinicMember.id)).all()


@router.post("/staff", response_model=StaffOut, status_code=201)
def create_staff(data: StaffInput, member: ClinicAdmin, db: Db):
    user = User(email=str(data.email).lower(), password_hash=password_hash.hash(data.temporary_password),
                role="staff", must_change_password=True)
    user.profile = Profile(**data.model_dump(include={"first_name", "last_name", "phone"}))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe una cuenta con este correo.") from None
    staff = ClinicMember(user_id=user.id, clinic_id=member.clinic_id, role=data.role)
    db.add(staff)
    db.commit()
    return db.scalar(staff_query(member.clinic_id).where(ClinicMember.id == staff.id))


@router.patch("/staff/{user_id}", response_model=StaffOut)
def update_staff(user_id: int, data: StaffUpdate, member: ClinicAdmin, db: Db):
    if user_id == member.user_id:
        raise HTTPException(409, "No puedes cambiar tu propio rol ni desactivarte. Pide ayuda a otro administrador.")
    staff = db.scalar(staff_query(member.clinic_id).where(ClinicMember.user_id == user_id).with_for_update(of=ClinicMember))
    if not staff:
        raise HTTPException(404, "No encontramos a ese miembro del equipo.")
    staff.role = data.role
    if staff.user.is_active and not data.is_active:
        staff.user.token_version += 1
    staff.user.is_active = data.is_active
    db.commit()
    return staff


# ---- Services -------------------------------------------------------------------------------

@router.get("/services", response_model=list[ServiceOut])
def list_clinic_services(member: Staff, db: Db):
    return db.scalars(select(VeterinaryService).where(VeterinaryService.clinic_id == member.clinic_id)
                      .order_by(VeterinaryService.is_active.desc(), VeterinaryService.name)).all()


def save_service(db, service: VeterinaryService):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Tu clínica ya tiene un servicio con ese nombre.") from None
    return service


@router.post("/services", response_model=ServiceOut, status_code=201)
def create_service(data: ServiceInput, member: ClinicAdmin, db: Db):
    service = VeterinaryService(clinic_id=member.clinic_id, **data.model_dump())
    db.add(service)
    return save_service(db, service)


@router.put("/services/{service_id}", response_model=ServiceOut)
def update_service(service_id: int, data: ServiceInput, member: ClinicAdmin, db: Db):
    service = db.scalar(select(VeterinaryService).where(VeterinaryService.id == service_id,
                                                        VeterinaryService.clinic_id == member.clinic_id))
    if not service:
        raise HTTPException(404, "No encontramos ese servicio.")
    for key, value in data.model_dump().items():
        setattr(service, key, value)
    return save_service(db, service)
