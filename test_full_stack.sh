#!/bin/bash
set -e

cd client
export $(grep -v '^#' .env.local | xargs)

npm run dev &
CLIENT_PID=$!
echo "Client PID: $CLIENT_PID"


cd ../server
export $(grep -v '^#' .env | xargs)

npm run build
npm start &
SERVER_PID=$!

sleep 2

# 🚀 브라우저 자동 실행
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" http://localhost:5173 &
"/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" http://localhost:5173 &


cleanup() {
    echo "Stopping dev resources..."
    kill $CLIENT_PID 2>/dev/null
    kill $SERVER_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

wait
