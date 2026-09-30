# =============================================================================
# Merkoteks Backend — FastAPI + LibreOffice (PDF headless)
# Build context: repo root (/app) — çünkü requirements-local.txt local-deploy'da
# =============================================================================
FROM python:3.11-slim-bookworm

# System deps: LibreOffice + Türkçe font'lar + poppler + build essentials
# unoconv: PDF dönüştürmeyi kalıcı bir LibreOffice "dinleyici" sürecine
# bağlanarak yapmamızı sağlar — bkz. server.py _xlsx_to_pdf /
# _ensure_libreoffice_listener. Bunsuz sistem eskisi gibi (yavaş ama
# çalışır) yönteme otomatik döner, o yüzden riski yok.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-calc \
    libreoffice-core \
    libreoffice-common \
    fonts-dejavu-core \
    fonts-liberation \
    poppler-utils \
    unoconv \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# LibreOffice sanity check at build time
RUN libreoffice --version && soffice --version
RUN unoconv --version || echo "UYARI: unoconv calismiyor, PDF donusturme eski (yavas) yontemle devam edecek"

WORKDIR /app

# Python deps (LOCAL — Emergent-only paketler çıkarıldı; emergentintegrations
# ve litellm server.py'de hiç import edilmediği için local'de gereksiz)
COPY local-deploy/backend/requirements-local.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

# Backend code + template dosyaları
COPY backend/server.py /app/server.py
COPY backend/tests/ /app/tests/
COPY backend/templates/ /app/templates/

# Upload directory (bind-mounted by docker-compose)
RUN mkdir -p /data/uploads

# Startup: LibreOffice binary kontrolü + uvicorn
EXPOSE 8001
CMD sh -c "which libreoffice && libreoffice --version && exec uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2"
