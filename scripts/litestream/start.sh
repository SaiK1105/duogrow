#!/usr/bin/env bash
# Boot sequence for the deployed service: restore the database from R2, seed it
# only if it is genuinely empty, then run the server under Litestream so writes
# keep replicating.
set -euo pipefail

REQUIRED_VARS=(DATA_DIR R2_BUCKET R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY)
missing=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    missing+=("$var")
  fi
done

# Degrade rather than crash when R2 is not configured. This keeps the service
# deployable before the bucket exists, and keeps the change safe to merge. It is
# loud about it: an operator reading the log must not mistake this for durable.
if [ ${#missing[@]} -gt 0 ]; then
  echo "[litestream] DISABLED — missing env: ${missing[*]}"
  echo "[litestream] The database is EPHEMERAL. It will be empty after the next deploy or restart."
  npm --prefix server run seed:if-empty
  exec npm start
fi

if [ ! -x bin/litestream ]; then
  echo "[litestream] FATAL: bin/litestream missing or not executable." >&2
  echo "[litestream] The build step (scripts/litestream/install.sh) did not run." >&2
  exit 1
fi

DB_PATH="${DATA_DIR}/duogrow.sqlite"
mkdir -p "${DATA_DIR}"

# Restore, and let a genuine failure abort the boot.
#
#   -if-db-not-exists   exit 0 when a database is already on disk
#   -if-replica-exists  exit 0 on a first-ever boot with no backup yet
#
# Both legitimate cases therefore succeed. Anything else — bad credentials, a
# wrong bucket, a corrupt replica — exits non-zero and `set -e` stops the boot.
# That is deliberate: starting anyway would serve an empty database, and an
# empty database is indistinguishable from having lost everyone's data.
echo "[litestream] restoring ${DB_PATH} from R2 if a backup exists"
bin/litestream restore -config litestream.yml -if-db-not-exists -if-replica-exists "${DB_PATH}"

if [ -f "${DB_PATH}" ]; then
  echo "[litestream] database present at ${DB_PATH}"
else
  echo "[litestream] no existing backup — this looks like the first ever boot"
fi

# Runs only when the users table is empty, so a restored database is untouched.
npm --prefix server run seed:if-empty

# Litestream supervises the server and exits when it does, so Render still sees
# a single foreground process and can restart the service normally.
echo "[litestream] replicating and starting the server"
exec bin/litestream replicate -config litestream.yml -exec "npm start"
