#!/bin/sh
set -e

# Scaffold Laravel on first run (when artisan doesn't exist yet)
if [ ! -f /app/artisan ]; then
  echo "==> Scaffolding Laravel 11..."
  composer create-project laravel/laravel:^11.0 /tmp/laravel --no-interaction
  cp -r /tmp/laravel/. /app/
  rm -rf /tmp/laravel
  echo "==> Laravel scaffolded."
fi

# Install/update dependencies
composer install --no-interaction --prefer-dist

# Set up .env if missing
if [ ! -f /app/.env ]; then
  cp /app/.env.example /app/.env
fi

# Configure app settings
sed -i "s/^#\? *APP_NAME=.*/APP_NAME=${APP_NAME:-Exibitions}/" /app/.env
sed -i "s/^#\? *APP_ENV=.*/APP_ENV=${APP_ENV:-local}/" /app/.env
sed -i "s/^#\? *APP_DEBUG=.*/APP_DEBUG=${APP_DEBUG:-true}/" /app/.env
sed -i "s/^#\? *APP_URL=.*/APP_URL=${APP_URL:-http:\/\/localhost:8080}/" /app/.env

# Configure DB connection (handles both commented and uncommented lines)
sed -i "s/^#\? *DB_CONNECTION=.*/DB_CONNECTION=${DB_CONNECTION:-pgsql}/" /app/.env
sed -i "s/^#\? *DB_HOST=.*/DB_HOST=${DB_HOST:-db}/" /app/.env
sed -i "s/^#\? *DB_PORT=.*/DB_PORT=${DB_PORT:-5432}/" /app/.env
sed -i "s/^#\? *DB_DATABASE=.*/DB_DATABASE=${DB_DATABASE:-exibitions}/" /app/.env
sed -i "s/^#\? *DB_USERNAME=.*/DB_USERNAME=${DB_USERNAME:-exibitions}/" /app/.env
sed -i "s/^#\? *DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD:-secret}/" /app/.env

# Generate app key if not set
php artisan key:generate --no-interaction --force

# Install Sanctum if not already installed
if ! grep -q "laravel/sanctum" /app/composer.json; then
  composer require laravel/sanctum --no-interaction
  php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider" --no-interaction
fi

echo "==> Starting Laravel..."
exec php artisan serve --host=0.0.0.0 --port=8000
