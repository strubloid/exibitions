#!/bin/sh
set -e

# Write Laravel .env from fly.io secrets / environment variables
cat > /app/.env << EOF
APP_NAME=${APP_NAME:-Exibitions}
APP_ENV=${APP_ENV:-production}
APP_KEY=${APP_KEY:-}
APP_DEBUG=${APP_DEBUG:-false}
APP_URL=${APP_URL:-https://exibit.strubloid.com}
APP_TIMEZONE=UTC
APP_LOCALE=en

DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST:-}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-exibitions}
DB_USERNAME=${DB_USERNAME:-exibitions}
DB_PASSWORD=${DB_PASSWORD:-}

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync

LOG_CHANNEL=stderr
LOG_LEVEL=${LOG_LEVEL:-error}
EOF

# Generate app key if not set
if [ -z "$APP_KEY" ]; then
  php artisan key:generate --force --no-interaction
fi

php artisan config:clear
php artisan route:cache

echo "==> Starting production services..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
