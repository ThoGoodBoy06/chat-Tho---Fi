FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --ignore-scripts

# Copy source code (includes prebuilt Flutter Web assets built with --web-renderer html)
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "server.js"]
