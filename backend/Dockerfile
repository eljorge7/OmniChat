FROM node:18-bullseye-slim

# Install Chromium, which automatically brings all the necessary shared libraries (libnss, libgbm, etc)
RUN apt-get update --allow-releaseinfo-change || apt-get update --fix-missing || true
RUN apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build the NestJS application
RUN npm run build

# Expose port (Internal)
EXPOSE 3002

# Start the server
CMD ["npm", "run", "start:prod"]
