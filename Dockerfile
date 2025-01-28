FROM node:18-alpine

# Add necessary packages
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first
COPY package*.json ./
COPY baucua-client/package*.json ./baucua-client/

# Install server dependencies
RUN npm install

# Install client dependencies
RUN cd baucua-client && npm install

# Copy rest of the application
COPY . .

# Set environment variable for legacy OpenSSL provider
ENV NODE_OPTIONS=--openssl-legacy-provider

# Expose ports
EXPOSE 9000 3000

# Start command
CMD ["npm", "run", "dev"]