FROM node:20-slim

# Install OpenSSL for Prisma & build tools for Flutter
RUN apt-get update -y && apt-get install -y openssl git curl unzip xz-utils zip

# Install Flutter SDK
RUN git clone https://github.com/flutter/flutter.git -b stable /flutter
ENV PATH="/flutter/bin:${PATH}"

# Enable Flutter Web
RUN flutter config --enable-web

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --ignore-scripts

# Copy source code
COPY . .

# Build Flutter Web with HTML renderer to fix iOS Safari CanvasKit distortion
RUN cd flutter_frontend && flutter pub get && flutter build web --web-renderer html --release

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "server.js"]
