# Sử dụng Node.js 18.12.1 LTS làm base image
FROM node:18.12.1

# Thiết lập thư mục làm việc cho backend
WORKDIR /usr/src/app

# Copy file package.json và package-lock.json của backend
COPY package.json package-lock.json ./

# Cài đặt dependency cho backend
RUN npm install

# Copy toàn bộ mã nguồn backend vào container (trừ frontend)
COPY . .

# Thiết lập thư mục làm việc cho frontend
WORKDIR /usr/src/app/baucua-client

# Copy file package.json và package-lock.json của frontend
COPY baucua-client/package.json baucua-client/package-lock.json ./

# Cài đặt dependency cho frontend (bao gồm react-scripts)
RUN npm install --legacy-peer-deps

# **Nếu cần build production**, uncomment dòng sau:
# RUN npm run build

# Quay lại thư mục gốc để backend phục vụ frontend (nếu cần)
WORKDIR /usr/src/app

# Mở cổng cho backend và frontend
EXPOSE 9000 3000

# Đặt biến môi trường cho React Development Server và OpenSSL
ENV HOST=0.0.0.0
ENV NODE_OPTIONS=--openssl-legacy-provider

# Khởi chạy cả backend và frontend server
CMD ["npm", "run", "dev"]
