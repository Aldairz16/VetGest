from datetime import date, datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9 ()-]{7,25}$")]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProfileInput(Input):
    first_name: Name
    last_name: Name
    phone: Phone


class RegisterInput(ProfileInput):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)
    password_confirmation: str = Field(min_length=10, max_length=128)

    @model_validator(mode="after")
    def matching_passwords(self):
        if self.password != self.password_confirmation:
            raise ValueError("Las contraseñas no coinciden.")
        return self


class LoginInput(Input):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ProfileOut(Output):
    first_name: str
    last_name: str
    phone: str


class PasswordInput(Input):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class MembershipOut(Output):
    clinic_id: int
    clinic_name: str
    role: Literal["admin", "vet", "reception"]


class UserOut(Output):
    id: int
    email: str
    role: Literal["owner", "staff", "platform_admin"]
    must_change_password: bool
    profile: ProfileOut
    membership: MembershipOut | None = None

    @model_validator(mode="before")
    @classmethod
    def flatten_membership(cls, value):
        member = getattr(value, "membership", None)
        if member is not None and not isinstance(value, dict):
            return {"id": value.id, "email": value.email, "role": value.role,
                    "must_change_password": value.must_change_password, "profile": value.profile,
                    "membership": {"clinic_id": member.clinic_id, "clinic_name": member.clinic.name, "role": member.role}}
        return value


class PetInput(Input):
    name: Name
    species: Literal["Perro", "Gato", "Ave", "Conejo", "Otro"]
    breed: Name
    sex: Literal["Macho", "Hembra"]
    birth_date: date
    weight: float = Field(ge=0.01, le=1000, multiple_of=0.01, allow_inf_nan=False)
    color: Name
    notes: str = Field(default="", max_length=2000)

    @field_validator("birth_date")
    @classmethod
    def valid_birth_date(cls, value: date):
        if value > datetime.now(ZoneInfo("America/Lima")).date():
            raise ValueError("La fecha de nacimiento no puede estar en el futuro.")
        if value < date(1900, 1, 1):
            raise ValueError("La fecha debe ser posterior al año 1900.")
        return value


class PetOut(PetInput, Output):
    id: int
    created_at: datetime
    updated_at: datetime


class ClinicOut(Output):
    id: int
    name: str
    address: str
    phone: str
    opening_hours: str
    description: str


class ServiceOut(Output):
    id: int
    clinic_id: int
    name: str
    description: str
    duration_minutes: int
    price: float
    is_active: bool


class ClinicInput(Input):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=250)]
    phone: Phone
    opening_hours: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=150)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=2000)]


class ServiceInput(Input):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]
    duration_minutes: int = Field(ge=5, le=600)
    price: float = Field(ge=0, le=100000, multiple_of=0.01, allow_inf_nan=False)
    is_active: bool = True


class StaffInput(ProfileInput):
    email: EmailStr = Field(max_length=254)
    role: Literal["admin", "vet", "reception"]
    temporary_password: str = Field(min_length=10, max_length=128)


class StaffUpdate(Input):
    role: Literal["admin", "vet", "reception"]
    is_active: bool


class StaffOut(Output):
    user_id: int
    email: str
    role: Literal["admin", "vet", "reception"]
    is_active: bool
    profile: ProfileOut

    @model_validator(mode="before")
    @classmethod
    def from_member(cls, value):
        if not isinstance(value, dict):
            return {"user_id": value.user_id, "email": value.user.email, "role": value.role,
                    "is_active": value.user.is_active, "profile": value.user.profile}
        return value


class ClinicAdminInput(ProfileInput):
    email: EmailStr = Field(max_length=254)
    temporary_password: str = Field(min_length=10, max_length=128)


class ClinicCreate(ClinicInput):
    admin: ClinicAdminInput


class ClinicStatusInput(Input):
    is_active: bool


class AdminClinicOut(ClinicOut):
    is_active: bool
    staff_count: int = 0
    appointment_count: int = 0


class StaffName(Output):
    id: int
    profile: ProfileOut


class AppointmentInput(Input):
    pet_id: int = Field(gt=0)
    clinic_id: int = Field(gt=0)
    service_id: int = Field(gt=0)
    starts_at: AwareDatetime
    reason: str = Field(default="", max_length=2000)


AppointmentStatus = Literal["Pendiente", "Confirmada", "Atendida", "Cancelada", "No asistió"]


class AppointmentOut(Output):
    id: int
    pet: PetOut
    clinic: ClinicOut
    service: ServiceOut
    starts_at: datetime
    reason: str
    status: AppointmentStatus
    vet: StaffName | None = None
    has_record: bool = False
    created_at: datetime
    updated_at: datetime


class OwnerContact(Output):
    first_name: str
    last_name: str
    phone: str


class ClinicAppointmentOut(AppointmentOut):
    owner: OwnerContact
    staff_notes: str


class AppointmentManage(Input):
    """Front-desk changes. Omitted fields stay unchanged."""
    status: Literal["Confirmada", "Cancelada", "No asistió"] | None = None
    vet_id: int | None = Field(default=None, gt=0)
    starts_at: AwareDatetime | None = None
    staff_notes: str | None = Field(default=None, max_length=2000)


class CareInput(Input):
    kind: Literal["Vacuna", "Desparasitación", "Tratamiento"]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    dose: str = Field(default="", max_length=120)
    applied_on: date
    next_due_on: date | None = None
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def coherent_dates(self):
        if self.applied_on > datetime.now(ZoneInfo("America/Lima")).date():
            raise ValueError("La fecha de aplicación no puede estar en el futuro.")
        if self.next_due_on and self.next_due_on < self.applied_on:
            raise ValueError("La próxima fecha debe ser posterior a la aplicación.")
        return self


class RecordInput(Input):
    appointment_id: int | None = Field(default=None, gt=0)
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]
    diagnosis: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=4000)]
    indications: str = Field(default="", max_length=4000)
    weight: float | None = Field(default=None, ge=0.01, le=1000, multiple_of=0.01, allow_inf_nan=False)
    next_visit_on: date | None = None
    care: list[CareInput] = Field(default_factory=list, max_length=10)


class ClinicName(Output):
    id: int
    name: str


class CareOut(Output):
    id: int
    kind: str
    name: str
    dose: str
    applied_on: date
    next_due_on: date | None
    notes: str
    clinic: ClinicName
    vet: StaffName


class RecordOut(Output):
    id: int
    pet_id: int
    appointment_id: int | None
    attended_at: datetime
    reason: str
    diagnosis: str
    indications: str
    weight: float | None
    next_visit_on: date | None
    clinic: ClinicName
    vet: StaffName


class HistoryOut(BaseModel):
    records: list[RecordOut]
    care: list[CareOut]


class PatientOut(PetOut):
    owner: OwnerContact


class Reminder(BaseModel):
    kind: Literal["Vacuna", "Desparasitación", "Tratamiento", "Control", "Cita"]
    title: str
    pet_id: int
    pet_name: str
    due: date
    overdue: bool
    clinic_name: str
