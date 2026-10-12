#!/bin/sh
set -eu

if [ -n "${APP_DB_PASSWORD_FILE:-}" ]; then
  [ -z "${APP_DB_PASSWORD:-}" ] || { echo "Use one application password source" >&2; exit 1; }
  APP_DB_PASSWORD=$(cat "$APP_DB_PASSWORD_FILE")
fi

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 --set=app_password="$APP_DB_PASSWORD" --set=db_name="$POSTGRES_DB" <<'SQL'
CREATE ROLE lab_app_user LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE :"db_name" TO lab_app_user;
SQL
