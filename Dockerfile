FROM node:18-alpine

# Add necessary packages
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first
COPY package*.json ./
COPY baucua-client/package*.json ./baucua-client/

# Install server dependencies
RUN npm install && \
    npm install express-rate-limit winston --save

# Install client dependencies
RUN cd baucua-client && npm install

# Copy rest of the application
COPY . .

# Build client
RUN cd baucua-client && npm run build

# Expose ports
EXPOSE 9000 3000

# Start command
CMD ["npm", "run", "dev"]