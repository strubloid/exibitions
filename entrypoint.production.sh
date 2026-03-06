#!/bin/sh
set -e

# Parse DATABASE_URL into individual vars if DB_HOST not set
if [ -z "$DB_HOST" ] && [ -n "$DATABASE_URL" ]; then
  DB_USERNAME=$(echo "$DATABASE_URL" | sed 's|.*://\([^:]*\):.*|\1|')
  DB_PASSWORD=$(echo "$DATABASE_URL" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|')
  DB_HOST=$(echo "$DATABASE_URL" | sed 's|.*@\([^:]*\):.*|\1|')
  DB_PORT=$(echo "$DATABASE_URL" | sed 's|.*:\([0-9]*\)/.*|\1|')
  DB_DATABASE=$(echo "$DATABASE_URL" | sed 's|.*/\([^?]*\).*|\1|')
fi

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

# Ensure Laravel cache directories exist
mkdir -p /app/storage/framework/{cache,sessions,views}

php artisan config:clear
php artisan route:cache

php artisan storage:link --force

# Start nginx + php immediately so fly.io health checks pass
echo "==> Starting production services..."
supervisord -c /etc/supervisor/conf.d/supervisord.conf &
SUPERVISOR_PID=$!

# Wait for PHP server to be ready before running migrations
# (artisan serve is single-threaded, so migrations block API requests briefly)
if [ -n "$DB_HOST" ]; then
  echo "==> Waiting for PHP server..."
  for attempt in $(seq 1 10); do
    if curl -s -o /dev/null http://127.0.0.1:8000 2>/dev/null; then
      break
    fi
    sleep 1
  done
  echo "==> Running migrations..."
  php artisan migrate --force --no-interaction
  php artisan db:seed --force --no-interaction
fi

# Hand control back to supervisord
wait $SUPERVISOR_PID
