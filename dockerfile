# Use a stable Debian-based Node for legacy deps like phantomjs
FROM node:16-bullseye

# System deps for headless rendering libs used by phantomjs/pdf tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates fontconfig libfreetype6 \
    && rm -rf /var/lib/apt/lists/*

# Ensure temp dirs and npm postinstall run correctly in container
ENV TMP=/tmp \
    TEMP=/tmp \
    TMPDIR=/tmp \
    npm_config_unsafe_perm=true

# Create app directory
WORKDIR /usr/src/app/codabe/admineex

# Install backend dependencies first for better caching
WORKDIR /usr/src/app/codabe/admineex/server
COPY server/package*.json ./
ENV NODE_ENV=production
RUN npm install --only=production

# Install frontend (public) dependencies
WORKDIR /usr/src/app/codabe/admineex/server/public
COPY server/public/package*.json ./
RUN npm install --only=production || true

# Copy the rest of the source code
WORKDIR /usr/src/app/codabe/admineex
COPY server ./server

# Expose app port (configurable via HTTP_PORT)
EXPOSE 4002

# Default environment
ENV HTTP_PORT=4002

# Start the app
WORKDIR /usr/src/app/codabe/admineex/server
CMD ["node", "./app.js"]