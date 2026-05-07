# 使用穩定的 Node.js 22 鏡像
FROM node:22-slim AS base

# 安裝必要的系統依賴 (OpenSSL 是 Prisma 必須的)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先複製依賴文件，利用 Docker 快取加速構建
COPY package*.json ./
RUN npm install

# 複製其餘代碼
COPY . .

# 生成 Prisma 客戶端
RUN npx prisma generate

# 構建 Next.js 應用
RUN npm run build

# --- 生產環境鏡像 ---
FROM node:22-slim AS runner
WORKDIR /app

# 安裝生產環境需要的系統依賴
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 從構建階段複製所有文件
COPY --from=base /app ./

# 移除 build-only 依賴，避免 listener runtime 載入 TypeScript toolchain
RUN npm prune --omit=dev

# 預設啟動 Web 服務 (Zeabur 中可以透過 CMD 覆蓋此指令)
CMD ["npm", "run", "start"]
