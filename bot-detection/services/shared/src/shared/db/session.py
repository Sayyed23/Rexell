from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

def get_engine(db_url: str):
    """
    Creates an async database engine.
    For production, db_url should refer to asyncpg (e.g., postgresql+asyncpg://...)
    """
    return create_async_engine(
        db_url,
        echo=False,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True
    )

def get_session_maker(engine):
    """Creates a configured async session maker."""
    return async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False
    )
