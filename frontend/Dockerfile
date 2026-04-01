FROM node:18-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Copy app source
COPY . .

# Next.js telemetry disable (optional)
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

EXPOSE 3003
ENV PORT=3003

# Next.js start command
CMD ["npm", "start"]
