FROM python:3.11.7-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

COPY requirements-deploy.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-deploy.txt

COPY . .

RUN mkdir -p nltk_data models && \
    python -c "
import nltk, os
nltk.data.path.insert(0, '/app/nltk_data')
for p in ['stopwords','wordnet','omw-1.4']:
    nltk.download(p, download_dir='/app/nltk_data', quiet=True)
print('NLTK ready')
"

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:10000/health')"

CMD ["gunicorn", "app:app", \
     "--bind", "0.0.0.0:10000", \
     "--workers", "1", \
     "--timeout", "120", \
     "--access-logfile", "-"]