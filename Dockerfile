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