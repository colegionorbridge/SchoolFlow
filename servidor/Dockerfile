FROM node:22-slim

# Instalar dependencias del sistema para Chrome
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates procps libxss1 libasound2 \
    libatk-bridge2.0-0 libgtk-3-0 libnss3 fonts-liberation \
    libgbm-dev curl --no-install-recommends \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configurar variables de entorno
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer_cache
ENV CHROME_PATH=""

WORKDIR /app

# 1. Copiar primero los archivos de empaquetado de Node
COPY package*.json ./

# 2. Instalar dependencias del proyecto (aquí se descarga Puppeteer de forma segura)
RUN npm install

# 3. Instalar el navegador Chrome usando el Puppeteer local
RUN npx puppeteer browsers install chrome

# 4. Crear symlink para que whatsapp-web.js encuentre Chrome
RUN CHROME_PATH=$(find /app/.puppeteer_cache -name "chrome" -type f 2>/dev/null | head -1) && \
    echo "Chrome instalado en: $CHROME_PATH" && \
    ln -sf "$CHROME_PATH" /usr/bin/google-chrome && \
    echo "Symlink creado"

# 5. Copiar el resto del código fuente y compilar
COPY . .
RUN npm run build

# Configurar permisos para el usuario node
RUN chown -R node:node /app
USER node

EXPOSE 4001

CMD sh -c "rm -f .wwebjs_auth/session-bot-norbridge/Singleton* && sleep 10 && node dist/index.js"
