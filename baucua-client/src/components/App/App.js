import React, { useEffect, useState } from "react";
import SocketContext from "contexts/socket-context";
import io from "socket.io-client";
import "./App.css";

// Components
import MainMenu from "components/MainMenu/MainMenu";
import Room from "components/Room/Room";

// Cấu hình endpoint
const ENDPOINT = process.env.NODE_ENV === 'production' 
  ? "http://167.235.150.190:9000"  // IP VPS của bạn
  : "http://localhost:9000";

// Cấu hình socket
const socket = io(ENDPOINT, {
  transports: ['websocket', 'polling'],
  cors: {
    origin: "*",
    credentials: true
  },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function App() {
  const [renderView, setRender] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Xử lý socket events
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.log('Connection error:', error);
    });

    // Cleanup khi component unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, []);

  const renderMainMenu = () => {
    if (connected) {
      socket.emit("removeplayer");
    }
    setRender(0);
  };

  const renderRoom = () => {
    setRender(1);
  };

  // Render loading khi chưa kết nối được
  if (!connected) {
    return <div>Connecting to server...</div>;
  }

  // Render views
  switch (renderView) {
    case 1:
      return (
        <SocketContext.Provider value={socket}>
          <Room onRenderMainMenu={renderMainMenu} />
        </SocketContext.Provider>
      );
    default:
      return (
        <SocketContext.Provider value={socket}>
          <MainMenu onRenderRoom={renderRoom} />
        </SocketContext.Provider>
      );
  }
}

export default App;