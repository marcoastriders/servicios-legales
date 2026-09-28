FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN node build.mjs

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
