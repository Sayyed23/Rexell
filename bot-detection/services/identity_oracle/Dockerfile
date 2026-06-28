FROM python:3.11-slim-bullseye

# Install system dependencies, including gnupg, curl, and build tools for pyodbc
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    build-essential \
    unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# Add Microsoft repository for MS SQL ODBC driver 17 (Bullseye)
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements.txt and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose port (Cloud Run will override this using the PORT env var)
EXPOSE 5000

# Start Uvicorn, using PORT environment variable if available
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-5000}"]
