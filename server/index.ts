import http from 'node:http';
import 'dotenv/config';
import { app } from './src/app';
import { attachWebSocket } from './src/ws/socket';

// HTTP server
const server = http.createServer(app);

// Attach WebSocket server
attachWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
