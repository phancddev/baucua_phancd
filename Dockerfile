# Dockerfile
FROM node:18-alpine

# Add necessary packages
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install all needed dependencies
RUN npm install && \
    npm install express-rate-limit@latest \
                winston@latest \
                nodemon@latest -g && \
    npm install --save-dev nodemon

# Copy rest of the application
COPY . .

# Expose ports
EXPOSE 9000 3000

# Start command
CMD ["npm", "run", "start"]

# docker-compose.yml
version: "3.9"

services:
  baucua-app:
    build: .
    container_name: baucua-game
    restart: unless-stopped
    ports:
      - "3000:3000"  # Frontend
      - "9000:9000"  # Backend & WebSocket
    environment:
      - NODE_ENV=production
      - PORT=9000
      - HOST=0.0.0.0
    volumes:
      - .:/app
      - /app/node_modules
    networks:
      - baucua-network

networks:
  baucua-network:
    driver: bridge