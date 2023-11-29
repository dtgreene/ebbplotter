import { proxy } from 'valtio';

let socket = null;

export const socketState = proxy({
  isConnected: false,
  serial: {
    isConnected: false,
  },
});

export function sendMessage(message) {
  if (socket instanceof WebSocket && socket.readyState === WebSocket.OPEN) {
    socket.send(message);
  }
}

export function cleanupSocket() {
  if (socket instanceof WebSocket) {
    socket.removeEventListener('close', handleClose, false);
    socket.removeEventListener('open', handleOpen, false);

    if (socket.readyState === WebSocket.OPEN) {
      socket.close();
    }

    socket = null;
  }
}

export function createSocket() {
  cleanupSocket();

  socketState.isConnected = false;

  socket = new WebSocket('ws://localhost:8080/socket');
  socket.addEventListener('close', handleClose, false);
  socket.addEventListener('open', handleOpen, false);
  socket.addEventListener('message', handleMessage, false);
}

function handleClose() {
  socketState.isConnected = false;
  setTimeout(createSocket, 2000);
}

function handleOpen() {
  socketState.isConnected = true;
}

function handleMessage(event) {
  try {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'status': {
        const { serial } = data.payload;
        socketState.serial.isConnected = serial.isConnected;

        break;
      }
      default: {
        console.warn(`Received unknown socket message type: ${data.type}`);
      }
    }
  } catch (error) {
    console.error(`Could not parse socket data: ${event.data}`);
  }
}
