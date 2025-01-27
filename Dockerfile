# Sử dụng Node.js 18.12.1 LTS
FROM node:18.12.1

# Thiết lập thư mục làm việc
WORKDIR /usr/src/app

# Copy file package.json và package-lock.json của backend
COPY package.json package-lock.json ./

# Cài đặt các dependency cho backend
RUN npm install

# Copy toàn bộ mã nguồn backend vào container
COPY . .

# Cài đặt các dependency cho frontend
WORKDIR /usr/src/app/baucua-client
COPY baucua-client/package.json baucua-client/package-lock.json ./
RUN npm install

# Build frontend
RUN npm run build

# Quay lại thư mục gốc để khởi chạy ứng dụng
WORKDIR /usr/src/app

# Mở cổng 9000 cho server
EXPOSE 9000

# Chạy ứng dụng
CMD ["npm", "run", "dev"]
