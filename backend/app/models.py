from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


ROLES = ("owner", "staff", "platform_admin")
CLINIC_ROLES = ("admin", "vet", "reception")
APPOINTMENT_STATUSES = ("Pendiente", "Confirmada", "Atendida", "Cancelada", "No asistió")
CARE_KINDS = ("Vacuna", "Desparasitación", "Tratamiento")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class User(Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("email = lower(email)", name="ck_user_email_normalized"),
        CheckConstraint(_in("role", ROLES), name="ck_user_role"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    role: Mapped[str] = mapped_column(String(20), default="owner", server_default="owner")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Accounts created by an administrator must replace their temporary password.
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False)
    membership: Mapped["ClinicMember | None"] = relationship(back_populates="user", uselist=False)


class Profile(Timestamps, Base):
    """Personal data shared by every account type; pets belong to a profile."""
    __tablename__ = "profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), unique=True)
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(25))
    user: Mapped[User] = relationship(back_populates="profile")


class Pet(Timestamps, Base):
    __tablename__ = "pets"
    __table_args__ = (
        UniqueConstraint("id", "owner_id", name="uq_pet_owner"),
        CheckConstraint("weight > 0 AND weight <= 1000", name="ck_pet_weight"),
        CheckConstraint("sex IN ('Macho','Hembra')", name="ck_pet_sex"),
        CheckConstraint("species IN ('Perro','Gato','Ave','Conejo','Otro')", name="ck_pet_species"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    species: Mapped[str] = mapped_column(String(20))
    breed: Mapped[str] = mapped_column(String(80))
    sex: Mapped[str] = mapped_column(String(10))
    birth_date: Mapped[date] = mapped_column(Date)
    weight: Mapped[Decimal] = mapped_column(Numeric(7, 2))
    color: Mapped[str] = mapped_column(String(80))
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner: Mapped[Profile] = relationship(foreign_keys=[owner_id], viewonly=True)


class VeterinaryClinic(Timestamps, Base):
    __tablename__ = "veterinary_clinics"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    address: Mapped[str] = mapped_column(String(250))
    phone: Mapped[str] = mapped_column(String(25))
    opening_hours: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    # Suspended clinics disappear from the owner catalog and their staff cannot sign in.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class ClinicMember(Timestamps, Base):
    __tablename__ = "clinic_members"
    __table_args__ = (CheckConstraint(_in("role", CLINIC_ROLES), name="ck_member_role"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    # One clinic per staff account keeps permissions unambiguous.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), unique=True)
    clinic_id: Mapped[int] = mapped_column(ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    user: Mapped[User] = relationship(back_populates="membership")
    clinic: Mapped[VeterinaryClinic] = relationship(viewonly=True)


class VeterinaryService(Timestamps, Base):
    __tablename__ = "veterinary_services"
    __table_args__ = (
        UniqueConstraint("id", "clinic_id", name="uq_service_clinic"),
        UniqueConstraint("clinic_id", "name", name="uq_clinic_service_name"),
        CheckConstraint("duration_minutes > 0", name="ck_service_duration"),
        CheckConstraint("price >= 0", name="ck_service_price"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    clinic_id: Mapped[int] = mapped_column(ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    # Services referenced by appointments are retired instead of deleted.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Appointment(Timestamps, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        ForeignKeyConstraint(["pet_id", "owner_id"], ["pets.id", "pets.owner_id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["service_id", "clinic_id"], ["veterinary_services.id", "veterinary_services.clinic_id"], ondelete="RESTRICT"),
        CheckConstraint(_in("status", APPOINTMENT_STATUSES), name="ck_appointment_status"),
        Index("ix_appointments_owner_status_start", "owner_id", "status", "starts_at"),
        Index("ix_appointments_clinic_start", "clinic_id", "starts_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="RESTRICT"))
    pet_id: Mapped[int] = mapped_column(Integer, index=True)
    clinic_id: Mapped[int] = mapped_column(ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"))
    service_id: Mapped[int] = mapped_column(Integer, index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text, default="", server_default="")
    status: Mapped[str] = mapped_column(String(12), default="Pendiente", server_default="Pendiente")
    vet_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    staff_notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    pet: Mapped[Pet] = relationship(foreign_keys=[pet_id, owner_id], viewonly=True)
    clinic: Mapped[VeterinaryClinic] = relationship(foreign_keys=[clinic_id], viewonly=True)
    service: Mapped[VeterinaryService] = relationship(foreign_keys=[service_id, clinic_id], viewonly=True)
    vet: Mapped[User | None] = relationship(foreign_keys=[vet_id], viewonly=True)
    owner: Mapped[Profile] = relationship(foreign_keys=[owner_id], viewonly=True)
    record: Mapped["MedicalRecord | None"] = relationship(
        primaryjoin="Appointment.id == MedicalRecord.appointment_id", viewonly=True, uselist=False)

    @property
    def has_record(self) -> bool:
        return self.record is not None


class MedicalRecord(Timestamps, Base):
    """A clinical attention. Records are append-only for traceability."""
    __tablename__ = "medical_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    pet_id: Mapped[int] = mapped_column(ForeignKey("pets.id", ondelete="RESTRICT"), index=True)
    clinic_id: Mapped[int] = mapped_column(ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"))
    vet_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id", ondelete="RESTRICT"), unique=True)
    attended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text)
    diagnosis: Mapped[str] = mapped_column(Text)
    indications: Mapped[str] = mapped_column(Text, default="", server_default="")
    weight: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    next_visit_on: Mapped[date | None] = mapped_column(Date)
    clinic: Mapped[VeterinaryClinic] = relationship(viewonly=True)
    vet: Mapped[User] = relationship(viewonly=True)


class CareEvent(Timestamps, Base):
    """Vaccines, deworming and treatments; next_due_on drives owner reminders."""
    __tablename__ = "care_events"
    __table_args__ = (
        CheckConstraint(_in("kind", CARE_KINDS), name="ck_care_kind"),
        CheckConstraint("next_due_on IS NULL OR next_due_on >= applied_on", name="ck_care_next_due"),
        Index("ix_care_events_pet_due", "pet_id", "next_due_on"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    pet_id: Mapped[int] = mapped_column(ForeignKey("pets.id", ondelete="RESTRICT"))
    clinic_id: Mapped[int] = mapped_column(ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"))
    vet_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    record_id: Mapped[int | None] = mapped_column(ForeignKey("medical_records.id", ondelete="RESTRICT"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(120))
    dose: Mapped[str] = mapped_column(String(120), default="", server_default="")
    applied_on: Mapped[date] = mapped_column(Date)
    next_due_on: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    clinic: Mapped[VeterinaryClinic] = relationship(viewonly=True)
    vet: Mapped[User] = relationship(viewonly=True)
