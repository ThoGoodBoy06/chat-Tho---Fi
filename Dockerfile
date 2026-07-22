FROM node:20-slim

WORKDIR /app/backend

# Copy package files
COPY backend/package*.json ./
RUN npm install

# Copy backend source
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "server.js"]
