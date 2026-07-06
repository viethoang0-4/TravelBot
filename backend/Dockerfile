# Compasso backend — image cho Hugging Face Spaces (Docker SDK).
# HF Spaces chạy container dạng non-root (UID 1000) và expose cổng 7860.
FROM python:3.13-slim

# build-essential để chắc chắn build được wheel của asyncpg/cryptography khi thiếu wheel sẵn.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user theo chuẩn HF Spaces
RUN useradd -m -u 1000 user
ENV PATH="/home/user/.local/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Cài deps trước để tận dụng cache layer
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Mã nguồn
COPY --chown=user . .

USER user

EXPOSE 7860

# Production: dùng cron NGOÀI cho job thời tiết → tắt scheduler in-process.
# (Có thể override bằng biến môi trường của Space.)
ENV SCHEDULER_ENABLED=false

# HF Spaces chặn mọi cổng outbound trừ 80/443/8080 → không gửi SMTP trực tiếp được.
# Backend trả email chờ gửi qua /internal/weather-check để cron GitHub Actions gửi hộ.
ENV EMAIL_DIRECT_SEND=false

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
