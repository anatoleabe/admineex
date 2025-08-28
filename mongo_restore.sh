#!/bin/bash
set -euo pipefail

DB_NAME="${MONGO_INITDB_DATABASE:-persabe}"
DUMP_BASE="/dump"
DB_DUMP_DIR="$DUMP_BASE/$DB_NAME"

# If a dump folder exists, try to restore it; otherwise skip
if [ -d "$DB_DUMP_DIR" ]; then
  echo "[mongo-init] Restoring MongoDB database '$DB_NAME' from $DB_DUMP_DIR"
  # Detect gzip
  if ls "$DB_DUMP_DIR"/*.gz >/dev/null 2>&1; then
    mongorestore --drop --gzip --db "$DB_NAME" "$DB_DUMP_DIR"
  else
    mongorestore --drop --db "$DB_NAME" "$DB_DUMP_DIR"
  fi
  echo "[mongo-init] Restore completed"
else
  # Fallback: if /dump contains a single directory, restore it into DB_NAME
  if [ -d "$DUMP_BASE" ]; then
    FIRST_SUBDIR=$(find "$DUMP_BASE" -mindepth 1 -maxdepth 1 -type d | head -n1 || true)
    if [ -n "$FIRST_SUBDIR" ]; then
      echo "[mongo-init] Restoring first dump directory $FIRST_SUBDIR into '$DB_NAME'"
      if ls "$FIRST_SUBDIR"/*.gz >/dev/null 2>&1; then
        mongorestore --drop --gzip --db "$DB_NAME" "$FIRST_SUBDIR"
      else
        mongorestore --drop --db "$DB_NAME" "$FIRST_SUBDIR"
      fi
      echo "[mongo-init] Restore completed"
    else
      echo "[mongo-init] No dump directory found in $DUMP_BASE; skipping restore"
    fi
  fi
fi
