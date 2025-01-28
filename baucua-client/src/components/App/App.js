import React, { useEffect, useState } from "react";
import SocketContext from "contexts/socket-context";
import io from "socket.io-client";
import "./App.css";

// Components
import MainMenu from "components/MainMenu/MainMenu";
import Room from "components/Room/Room";

// Cấu hình endpoint
const ENDPOINT = process.env.REACT_APP_SOCKET_URL || "http://localhost:9000";

// Cấu hình socket
const socket = io(ENDPOINT, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

function App() {
  const [renderView, setRender] = useState(0); // 0: MainMenu, 1: Room
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    // Xử lý sự kiện socket
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError(error.message || 'Could not connect to server.');
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

  if (!connected && connectionError) {
    return (
      <div>
        <h1>Connection Error</h1>
        <p>{connectionError}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!connected) {
    return (
      <div>
        <h1>Connecting to server...</h1>
      </div>
    );
  }

  // Render views
  return (
    <SocketContext.Provider value={socket}>
      {renderView === 1 ? (
        <Room onRenderMainMenu={renderMainMenu} />
      ) : (
        <MainMenu onRenderRoom={renderRoom} />
      )}
    </SocketContext.Provider>
  );
}

export default App;
