import React, { useState, useContext } from "react";
import SocketContext from "contexts/socket-context";
import "./JoinModal.css";

// Fontawesome Icons
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDoorOpen } from "@fortawesome/free-solid-svg-icons";

function JoinModal(props) {
  const socket = useContext(SocketContext);

  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onChangeName = (event) => {
    setName(event.target.value);
  };

  const onChangeRoom = (event) => {
    setRoom(event.target.value.toUpperCase()); // Chuyển về chữ hoa để tránh sai lệch
  };

  const handleJoinClick = () => {
    if (name.trim() === "" || room.trim() === "") {
      setErrorMessage("Please enter both your name and a room code.");
      return;
    }

    console.log("🔄 Checking room availability:", room);

    // Kiểm tra xem room có tồn tại không
    socket.emit("check", { room }, (error) => {
      if (error) {
        setErrorMessage(error);
        console.log("❌ Room check failed:", error);
      } else {
        console.log("✅ Room exists, attempting to join...");

        // Gửi yêu cầu join room
        socket.emit("join", { name, room }, (response) => {
          if (response) {
            setErrorMessage(response);
            console.log("❌ Join failed:", response);
          } else {
            console.log("✅ Successfully joined room:", room);
            props.onJoinClick();
          }
        });
      }
    });
  };

  return (
    <div className="join-modal">
      <FontAwesomeIcon
        id="join-icon"
        style={{ color: "#353535" }}
        icon={faDoorOpen}
        size="4x"
      />
      <p className="join-modal-title">Join a room.</p>
      
      {errorMessage && <p className="join-modal-error">{errorMessage}</p>}

      <input
        type="text"
        className="join-modal-input"
        placeholder="Enter your name"
        onChange={onChangeName}
        maxLength="12"
        autoComplete="off"
      />
      <input
        type="text"
        className="join-modal-input"
        placeholder="Enter room code"
        onChange={onChangeRoom}
        maxLength="6"
        autoComplete="off"
      />
      <div className="join-modal-btns">
        <button className="join-modal-cancel-btn" onClick={props.onCancelClick}>
          Cancel
        </button>
        <button className="join-modal-join-btn" onClick={handleJoinClick}>
          Join
        </button>
      </div>
    </div>
  );
}

export default JoinModal;
