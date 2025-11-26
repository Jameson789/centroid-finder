# First Stage: Build Jar with Maven
FROM maven:4.0.0-rc-4-eclipse-temurin-21 AS java-builder
WORKDIR /app
COPY Processor/pom.xml .
COPY Processor/src ./src
RUN mvn clean package -DskipTests


# Second Stage: Build node back end
FROM node:20-slim AS backend-builder

# Install Java and ffmpeg
RUN apt-get update && \
    apt-get install -y openjdk-17-jre ffmpeg && \
    apt-get clean

# Set working directory
WORKDIR /app

# Copy package files for dependencies
COPY server/package*.json ./server/

# Install dependencies
RUN npm --prefix server install --omit=dev

# Copy everything else
COPY server ./server
COPY --from=java-builder /app/target/*.jar /app/Processor/target/

# Set environment variables
ENV VIDEO_PATH=/videos
ENV RESULT_PATH=/results

# Expose ports for backend
EXPOSE 3000

# Start backend
CMD ["npm", "--prefix", "server", "start"]

FROM node:20-slim AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend install --omit=dev

COPY frontend ./frontend

RUN npm --prefix frontend run build

EXPOSE 3001

CMD ["npm", "--prefix", "frontend", "start"]
