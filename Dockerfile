# Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --force
COPY frontend/ ./
RUN npm run build

# Build Backend
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Copy compiled frontend to expected embed location
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build -o mergefolders .

# Final Stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=backend-builder /app/mergefolders .
# Default environment variables
ENV GIN_MODE=release
ENV PORT=8080
EXPOSE 8080
# Create necessary directories
RUN mkdir -p /app/data /app/cache
CMD ["./mergefolders"]
