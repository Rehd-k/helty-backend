#!/bin/sh
set -eu

echo "Running prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy

echo "Starting Helty API on PORT=${PORT:-3000}..."
exec node dist/main.js
