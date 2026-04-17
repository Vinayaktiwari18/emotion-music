FROM python:3.11.7-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements-deploy.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-deploy.txt

# Copy project files
COPY . .

# ✅ SAFE NLTK DOWNLOAD (heredoc method — no Docker parsing issues)
RUN mkdir -p /app/nltk_data /app/models && \
    python - <<EOF
import nltk
nltk.data.path.insert(0, '/app/nltk_data')
for p in ['stopwords','wordnet','omw-1.4']:
    nltk.download(p, download_dir='/app/nltk_data', quiet=True)
print("NLTK ready")
EOF

# Environment variable
ENV NLTK_DATA=/app/nltk_data

# Expose port
EXPOSE 10000

# Start app
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:10000", "--workers", "1", "--timeout", "120"]
