import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      auth: { token: useAuthStore.getState().accessToken },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  const token = useAuthStore.getState().accessToken;
  if (token) s.auth = { token };
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  socket?.disconnect();
}

export function subscribeToGame(gameId: string) {
  getSocket().emit('subscribe:game', gameId);
}

export function unsubscribeFromGame(gameId: string) {
  getSocket().emit('unsubscribe:game', gameId);
}
