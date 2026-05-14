FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire monorepo
COPY . /app

# Set workdir to where the API code lives
WORKDIR /app/apps/api

# Railway injects PORT env var
ENV PORT=8000
EXPOSE ${PORT}

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
