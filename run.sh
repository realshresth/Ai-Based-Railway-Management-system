#!/bin/bash
# Starts backend (5000) and frontend (5173). Needs Node.js and MySQL running.
cd "$(dirname "$0")"
(cd backend && [ -d node_modules ] || npm install --prefix backend)
(cd frontend && [ -d node_modules ] || npm install --prefix frontend)
(cd backend && npm run dev) &
(cd frontend && npm run dev)
