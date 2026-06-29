import os
import urllib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# MS SQL Server Connection Details from .env
MSSQL_SERVER = os.getenv("MSSQL_SERVER", "localhost")
MSSQL_DB = os.getenv("MSSQL_DB", "RexellIdentity")
MSSQL_USER = os.getenv("MSSQL_USER", "sa")
MSSQL_PASSWORD = os.getenv("MSSQL_PASSWORD", "YourStrong!Passw0rd")
ODBC_DRIVER = os.getenv("ODBC_DRIVER", "ODBC Driver 17 for SQL Server")
USE_WINDOWS_AUTH = os.getenv("USE_WINDOWS_AUTH", "false").lower() == "true"

# Determine connection configuration and fallback automatically if SQL Server is not available
use_sqlite = False
conn_str = ""

try:
    import pyodbc
    available_drivers = pyodbc.drivers()
    
    # If the configured driver isn't installed, check if generic "SQL Server" is available
    chosen_driver = ODBC_DRIVER
    if chosen_driver not in available_drivers:
        # Check if generic "SQL Server" is installed
        alternative = [d for d in available_drivers if "SQL Server" in d]
        if alternative:
            chosen_driver = alternative[0]
        else:
            use_sqlite = True

    if not use_sqlite:
        if USE_WINDOWS_AUTH:
            conn_str = (
                f"DRIVER={{{chosen_driver}}};"
                f"SERVER={MSSQL_SERVER};"
                f"DATABASE={MSSQL_DB};"
                f"Trusted_Connection=yes;"
            )
        else:
            conn_str = (
                f"DRIVER={{{chosen_driver}}};"
                f"SERVER={MSSQL_SERVER};"
                f"DATABASE={MSSQL_DB};"
                f"UID={MSSQL_USER};"
                f"PWD={MSSQL_PASSWORD};"
            )
except Exception:
    use_sqlite = True

# Construct URL and create the database engine
DATABASE_URL_ENV = os.getenv("DATABASE_URL")

if DATABASE_URL_ENV:
    # Render/Railway postgres database injection fix
    if DATABASE_URL_ENV.startswith("postgres://"):
        DATABASE_URL_ENV = DATABASE_URL_ENV.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL_ENV, echo=False)
elif use_sqlite:
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "identity_oracle.db"))
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}, 
        echo=False
    )
else:
    params = urllib.parse.quote_plus(conn_str)
    DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={params}"
    try:
        engine = create_engine(DATABASE_URL, echo=False)
        # Test connection immediately
        with engine.connect() as conn:
            pass
    except Exception:
        # If SQL Server connection fails, fall back to SQLite
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "identity_oracle.db"))
        DATABASE_URL = f"sqlite:///{db_path}"
        engine = create_engine(
            DATABASE_URL, 
            connect_args={"check_same_thread": False}, 
            echo=False
        )

# Session Local
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
