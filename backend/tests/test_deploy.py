import pytest
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.core.config import Settings
from app.seed import lock_down_data_api


def test_supabase_data_api_cannot_read_tables(test_engine):
    # Simulate Supabase's API roles with its default grants on the public schema.
    with test_engine.begin() as conn:
        for role in ("anon", "authenticated"):
            conn.execute(text(f"DO $$ BEGIN CREATE ROLE {role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$"))
            conn.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
            conn.execute(text(f"GRANT ALL ON ALL TABLES IN SCHEMA public TO {role}"))
    lock_down_data_api()
    with test_engine.connect() as conn:
        rls = conn.scalar(text("SELECT bool_and(rowsecurity) FROM pg_tables WHERE schemaname = 'public'"))
        assert rls is True
        conn.execute(text("SET ROLE anon"))
        with pytest.raises(ProgrammingError):
            conn.execute(text("SELECT password_hash FROM users"))
        conn.rollback()


def test_database_url_normalized_for_psycopg():
    settings = Settings(database_url="postgresql://u:p@db.example.supabase.co:5432/postgres", jwt_secret="x" * 32)
    assert settings.db_url.startswith("postgresql+psycopg://")
    with pytest.raises(ValueError):
        Settings(_env_file=None, jwt_secret="x" * 32, postgres_password=None, database_url=None)
