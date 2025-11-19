#!/bin/bash
set -e

cd client
export $(grep -v '^#' .env.local | xargs)

# npm 자식 프로세스까지 묶기 위해 setsid 사용
setsid npm run dev &
CLIENT_PGID=$!
echo "Client group: $CLIENT_PGID"

cd ../server
export $(grep -v '^#' .env | xargs)

npm run build

setsid npm start &
SERVER_PGID=$!
echo "Server group: $SERVER_PGID"

sleep 2

"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" http://localhost:5173 &
"/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" http://localhost:5173 &

cleanup() {
    echo "Stopping dev resources..."

    # 프로세스 그룹 전체 종료
    kill -TERM -$CLIENT_PGID 2>/dev/null
    kill -TERM -$SERVER_PGID 2>/dev/null

    exit 0
}

trap cleanup SIGINT SIGTERM

wait
