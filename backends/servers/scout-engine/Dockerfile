# Scout Event Ingestion Engine runtime image
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY dist ./dist
COPY node_modules ./node_modules
EXPOSE 4455
CMD ["node", "dist/server.js"]
