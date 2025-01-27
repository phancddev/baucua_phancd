# Sử dụng Node.js 18.12.1 LTS làm base image
FROM node:18.12.1

# Thiết lập thư mục làm việc
WORKDIR /usr/src/app

# Copy file package.json và package-lock.json của backend
COPY package.json package-lock.json ./

# Cài đặt dependency cho backend
RUN npm install

# Copy toàn bộ mã nguồn backend vào container
COPY . .

# Thiết lập thư mục làm việc cho frontend
WORKDIR /usr/src/app/baucua-client

# Copy file package.json và package-lock.json của frontend
COPY baucua-client/package.json baucua-client/package-lock.json ./

# Cài đặt dependency cho frontend
RUN npm install --legacy-peer-deps

# Build frontend
RUN npm run build

# Quay lại thư mục gốc để khởi chạy ứng dụng
WORKDIR /usr/src/app

# Mở cổng cho server backend
EXPOSE 9000

# Khởi chạy backend server
CMD ["npm", "run", "dev"]
