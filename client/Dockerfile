# Stage 1: Build the React application
FROM node:18-alpine as build
ARG REACT_APP_API_SERVER
ARG REACT_APP_VIDEO_SERVER

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV REACT_APP_API_SERVER=$REACT_APP_API_SERVER
ENV REACT_APP_VIDEO_SERVER=$REACT_APP_VIDEO_SERVER
RUN npm run build

# Stage 2: Serve the React application using Nginx
FROM nginx:1.25-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
