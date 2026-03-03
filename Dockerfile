# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Production image — nginx + PHP + Laravel
FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    nginx supervisor git curl unzip libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# React build → nginx html root
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Laravel backend
WORKDIR /app
COPY backend/ .
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Configs — remove Debian default site, use our config
RUN rm -f /etc/nginx/sites-enabled/default
COPY nginx/production.conf /etc/nginx/conf.d/default.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.production.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
