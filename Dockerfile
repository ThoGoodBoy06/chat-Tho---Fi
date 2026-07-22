FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "server.js"]
