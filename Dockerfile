# Sử dụng Node.js LTS
FROM node:18.12.1

# Cài đặt thư mục làm việc
WORKDIR /usr/src/app

# Sao chép package.json và cài đặt dependency
COPY package.json package-lock.json ./
RUN npm install

# Sao chép toàn bộ mã nguồn
COPY . .

# Mở cổng 9000 (backend) và 3000 (frontend)
EXPOSE 9000
EXPOSE 3000

# Khởi chạy server
CMD ["npm", "run", "dev"]
