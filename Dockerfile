# First Stage: Build Jar with Maven
# Maven images have a lot of vulnerabilities for some reason
FROM maven:3.8.5-openjdk-17 AS java-builder
WORKDIR /app
COPY Processor/pom.xml .
COPY Processor/src ./src
RUN mvn clean package -DskipTests


# Second Stage: Build node front end and back end
FROM node:20-slim

# Install Java and ffmpeg
RUN apt-get update && \
    apt-get install -y openjdk-17-jdk ffmpeg && \
    apt-get clean

# Set working directory
WORKDIR /app

# Copy package files for dependencies
COPY package*.json ./
COPY server/package*.json ./server/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install
RUN npm --prefix server install --omit=dev
RUN npm --prefix frontend install --omit=dev

# Copy everything else
COPY . .
COPY --from=java-builder /app/target/*.jar /app/Processor/target/

# Set environment variables
ENV VIDEO_PATH=/videos
ENV RESULT_PATH=/results

# Expose ports for both frontend and backend
EXPOSE 3000
EXPOSE 3001

# Start both frontend and backend
CMD ["npm", "run", "dev"]
