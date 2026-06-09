FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache ffmpeg python3 make g++
RUN npm ci --only=production
COPY . .
EXPOSE 4000
EXPOSE 4001
CMD [ "npm", "run", "start:api"]
