FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --omit=dev

# Install frontend dependencies and build
COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend --include=dev

COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# Copy backend source and built frontend
COPY backend/ ./backend/
RUN mkdir -p backend/public && cp -r frontend/dist/. backend/public/

EXPOSE 3000

CMD ["node", "backend/server.js"]
