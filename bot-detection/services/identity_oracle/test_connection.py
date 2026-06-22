import os
import urllib
import pyodbc
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv()

# MS SQL Server Connection Details from .env
MSSQL_SERVER = os.getenv("MSSQL_SERVER", "localhost")
MSSQL_DB = os.getenv("MSSQL_DB", "RexellIdentity")
MSSQL_USER = os.getenv("MSSQL_USER", "")
MSSQL_PASSWORD = os.getenv("MSSQL_PASSWORD", "")
ODBC_DRIVER = os.getenv("ODBC_DRIVER", "ODBC Driver 17 for SQL Server")
USE_WINDOWS_AUTH = os.getenv("USE_WINDOWS_AUTH", "false").lower() == "true"

print(f"Attempting to connect to Server: {MSSQL_SERVER}, Database: {MSSQL_DB}")

try:
    if USE_WINDOWS_AUTH:
        print("Using Windows Authentication (Trusted_Connection=yes)...")
        conn_str = (
            f"DRIVER={{{ODBC_DRIVER}}};"
            f"SERVER={MSSQL_SERVER};"
            f"DATABASE={MSSQL_DB};"
            f"Trusted_Connection=yes;"
        )
    else:
        print(f"Using SQL Server Authentication with user: {MSSQL_USER}...")
        conn_str = (
            f"DRIVER={{{ODBC_DRIVER}}};"
            f"SERVER={MSSQL_SERVER};"
            f"DATABASE={MSSQL_DB};"
            f"UID={MSSQL_USER};"
            f"PWD={MSSQL_PASSWORD};"
        )
    
    # Test pyodbc directly first
    print("\n1. Testing direct pyodbc connection...")
    conn = pyodbc.connect(conn_str)
    print("SUCCESS: PyODBC Connection Successful!")
    conn.close()

    # Test SQLAlchemy
    print("\n2. Testing SQLAlchemy engine...")
    params = urllib.parse.quote_plus(conn_str)
    DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={params}"
    engine = create_engine(DATABASE_URL)
    with engine.connect() as connection:
        print("SUCCESS: SQLAlchemy Connection Successful!")

    print("\nEverything is fully connected and ready to use!")

except Exception as e:
    print("\nFAILED: Connection Failed!")
    print(f"Error Details: {str(e)}")
    print("\nPlease check your .env file credentials and ensure MS SQL Server is running.")
