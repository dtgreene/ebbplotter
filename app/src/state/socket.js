import { proxy } from 'valtio';

let socket = null;

export const socketState = proxy({
  socket: {
    isConnected: false,
  },
  plotter: {
    isConnected: false,
    isPlotting: false,
  },
  plotProgress: 0,
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

// FireFox exponentially backs off the WebSocket close event by up to 60 seconds
// resulting in longer reconnect times if the socket can't connect after a
// few attempts.

// If this becomes too annoying for FireFox users, a manual timeout will need to
// be implemented. For now, refreshing the page and/or waiting works.
export function createSocket() {
  cleanupSocket();

  socketState.socket.isConnected = false;

  socket = new WebSocket('ws://localhost:8080/socket');
  socket.addEventListener('close', handleClose, false);
  socket.addEventListener('open', handleOpen, false);
  socket.addEventListener('message', handleMessage, false);
}

function handleClose() {
  socketState.socket.isConnected = false;
  socketState.plotter.isConnected = false;
  setTimeout(createSocket, 2000);
}

function handleOpen() {
  socketState.socket.isConnected = true;
}

function handleMessage(event) {
  try {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'status': {
        socketState.plotter = data.payload;
        break;
      }
      case 'progress': {
        socketState.plotProgress = data.payload;
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
