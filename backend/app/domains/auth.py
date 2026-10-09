from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.core.security import (
    CurrentUser,
    Db,
    can_sign_in,
    create_token,
    dummy_hash,
    password_hash,
)
from app.models import Profile, User
from app.schemas import LoginInput, PasswordInput, ProfileInput, RegisterInput, UserOut

router = APIRouter(prefix="/auth", tags=["Cuenta"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: RegisterInput, db: Db):
    # Public sign-up only creates owners; staff accounts are created by administrators.
    user = User(email=str(data.email).lower(), password_hash=password_hash.hash(data.password), role="owner")
    user.profile = Profile(**data.model_dump(include={"first_name", "last_name", "phone"}))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe una cuenta con este correo.") from None
    return user


@router.post("/login", response_model=UserOut)
def login(data: LoginInput, response: Response, db: Db):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    valid = password_hash.verify(data.password, user.password_hash if user else dummy_hash)
    if not user or not valid:
        raise HTTPException(401, "El correo o la contraseña son incorrectos.")
    if not can_sign_in(user):
        raise HTTPException(403, "Tu cuenta o tu veterinaria está desactivada. Contacta a su administrador.")
    settings = get_settings()
    response.set_cookie("vetgest_session", create_token(user), httponly=True,
                        secure=settings.cookie_secure, samesite="lax", path="/api",
                        max_age=settings.token_minutes * 60)
    return user


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.patch("/profile", response_model=UserOut)
def update_profile(data: ProfileInput, user: CurrentUser, db: Db):
    for key, value in data.model_dump().items():
        setattr(user.profile, key, value)
    db.commit()
    return user


@router.post("/password", response_model=UserOut)
def change_password(data: PasswordInput, user: CurrentUser, db: Db, response: Response):
    if not password_hash.verify(data.current_password, user.password_hash):
        raise HTTPException(422, "La contraseña actual no es correcta.")
    if data.new_password == data.current_password:
        raise HTTPException(422, "La nueva contraseña debe ser distinta de la actual.")
    user.password_hash = password_hash.hash(data.new_password)
    user.must_change_password = False
    # Revoke other sessions, then reissue this one.
    user.token_version += 1
    db.commit()
    settings = get_settings()
    response.set_cookie("vetgest_session", create_token(user), httponly=True,
                        secure=settings.cookie_secure, samesite="lax", path="/api",
                        max_age=settings.token_minutes * 60)
    return user


@router.post("/logout", status_code=204)
def logout(user: CurrentUser, db: Db, response: Response):
    db.execute(update(User).where(User.id == user.id).values(token_version=User.token_version + 1))
    db.commit()
    response.delete_cookie("vetgest_session", path="/api", httponly=True,
                           secure=get_settings().cookie_secure, samesite="lax")
