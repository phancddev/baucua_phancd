import React, { useState, useContext, useEffect } from "react";
import SocketContext from "contexts/socket-context";
import "./HostModal.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";

function HostModal(props) {
  const socket = useContext(SocketContext);
  const [name, setName] = useState("");
  const [room] = useState(
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );

  useEffect(() => {
    // Log socket status when component mounts
    console.log('Socket connected:', socket.connected);
    console.log('Socket ID:', socket.id);

    // Listen for connect/disconnect events
    socket.on('connect', () => {
      console.log('Socket connected in HostModal');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected in HostModal');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket]);

  const onChangeName = (event) => {
    const input = event.target.value;
    setName(input);
    // Reset error class if user starts typing
    const nameInput = document.getElementById("name-input");
    nameInput.classList.remove("host-modal-input-error");
    nameInput.classList.add("host-modal-input");
  };

  const checkNameInput = () => {
    if (!name.trim()) {
      const nameInput = document.getElementById("name-input");
      nameInput.classList.remove("host-modal-input");
      nameInput.classList.add("host-modal-input-error");
      return false;
    }
    return true;
  };

  const handleHostClick = () => {
    if (!socket.connected) {
      console.error('Socket not connected');
      props.onInvalidCode("Connection error. Please try again.");
      return;
    }

    if (checkNameInput()) {
      document.body.style.overflow = "auto";
      console.log('Emitting host event:', { name, room });
      
      socket.emit("host", { name, room }, (error) => {
        console.log('Host callback response:', error);
        
        if (error) {
          console.error('Host error:', error);
          props.onInvalidCode(error);
        } else {
          console.log('Host successful, setting up room');
          socket.emit("roomsetup");
          props.onHostClick();
        }
      });
    }
  };

  const onKeyUp = (event) => {
    if (event.key === "Enter") {
      handleHostClick();
    }
  };

  return (
    <div className="host-modal">
      <FontAwesomeIcon style={{ color: "#353535" }} icon={faUsers} size="4x" />
      <p className="host-modal-title">Host a room.</p>
      <input
        id="name-input"
        type="text"
        className="host-modal-input"
        placeholder="Enter your name"
        value={name}
        onKeyUp={onKeyUp}
        onChange={onChangeName}
        maxLength="12"
        autoComplete="off"
      />
      <div className="host-modal-btns">
        <button className="host-modal-cancel-btn" onClick={props.onCancelClick}>
          Cancel
        </button>
        <button 
          className="host-modal-host-btn" 
          onClick={handleHostClick}
          disabled={!socket.connected}
        >
          Host
        </button>
      </div>
    </div>
  );
}

export default HostModal;