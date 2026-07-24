FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm install --ignore-scripts

# Copy backend source code
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "server.js"]
