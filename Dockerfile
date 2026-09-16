FROM node:24-slim

# 1. Install system dependencies & Bun Baseline
RUN apt-get update && apt-get install -y \
    curl unzip git gnupg ca-certificates \
    libnss3 libgbm1 libasound2 libxshmfence1 \
    which cron --no-install-recommends

# 3. Modern Chrome Install (The 'signed-by' way)
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | \
    gpg --dearmor -o /usr/share/keyrings/google-chrome-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 4. Build Kolshek from Source
WORKDIR /opt/kolshek
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN git clone https://github.com/Isaac-D20/kolshek.git . \
    && npm install \
    && npm run build \
    && npm link

ENTRYPOINT ["kolshek", "dashboard", "--no-open"]