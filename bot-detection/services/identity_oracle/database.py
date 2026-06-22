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

if USE_WINDOWS_AUTH:
    conn_str = (
        f"DRIVER={{{ODBC_DRIVER}}};"
        f"SERVER={MSSQL_SERVER};"
        f"DATABASE={MSSQL_DB};"
        f"Trusted_Connection=yes;"
    )
else:
    conn_str = (
        f"DRIVER={{{ODBC_DRIVER}}};"
        f"SERVER={MSSQL_SERVER};"
        f"DATABASE={MSSQL_DB};"
        f"UID={MSSQL_USER};"
        f"PWD={MSSQL_PASSWORD};"
    )

# Construct the SQLAlchemy connection string
params = urllib.parse.quote_plus(conn_str)
DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={params}"

# Create the engine
engine = create_engine(DATABASE_URL, echo=False)

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
