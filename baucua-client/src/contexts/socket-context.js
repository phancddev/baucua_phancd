import React, { createContext } from "react";
import io from 'socket.io-client';

// Tạo socket connection
const ENDPOINT = 'http://167.235.150.190:9000'; // IP của VPS của bạn

const socket = io(ENDPOINT, {
  transports: ['websocket', 'polling'],
  cors: {
    origin: "*",
    credentials: true
  },
  reconnection: true,
  reconnectionAttempts: 5
});

// Tạo context
export const SocketContext = createContext();

// Tạo provider component
export const SocketProvider = ({ children }) => {
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;