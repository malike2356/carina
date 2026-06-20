# Scout Event Ingestion Server Dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files and install
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built source
COPY dist ./dist

# Expose port
EXPOSE 4444

# Start the event ingestion server
CMD ["node", "dist/src/server.js"]
