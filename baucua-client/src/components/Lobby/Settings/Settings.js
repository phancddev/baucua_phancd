import React, { useEffect } from "react";
import "./Settings.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faDice,
  faMoneyBill,
} from "@fortawesome/free-solid-svg-icons";

function Settings(props) {
  useEffect(() => {
    if (!props.isHost) {
      var inputs = document.getElementsByClassName("setting-input");
      for (let i = 0; i < inputs.length; i++) {
        inputs[i].disabled = true;
        inputs[i].classList.add("disable");
      }
    }

    if (props.isHost) {
      var disabled_inputs = document.getElementsByClassName("disable");
      while (disabled_inputs.length > 0) {
        disabled_inputs[0].disabled = false;
        disabled_inputs[0].classList.remove("disable");
      }
    }
  }, [props.isHost]);

  const onInputChange = (event) => {
    const value = event.target.value === '' ? '' : parseInt(event.target.value);
    props.onSettingsChange(event.target.id, value);
  };

  return (
    <div className="lobby-options">
      <label>
        <span className="setting-label">
          <FontAwesomeIcon icon={faClock} className="setting-icon" />
          Time:
        </span>
        <input
          id="timer"
          type="number" 
          className="setting-input"
          onChange={onInputChange}
          value={props.timer}
          min="0"
        /> s
      </label>

      <label>
        <span className="setting-label">
          <FontAwesomeIcon icon={faDice} className="setting-icon" />
          Rounds:
        </span>
        <input
          id="rounds"
          type="number"
          className="setting-input"
          onChange={onInputChange}
          value={props.rounds}
          min="0"
        />
      </label>

      <label>
        <span className="setting-label">
          <FontAwesomeIcon icon={faMoneyBill} className="setting-icon" />
          Balance:
        </span>
        <input
          id="balance"
          type="number"
          className="setting-input"
          onChange={onInputChange}
          value={props.balance}
          min="0"
        /> $
      </label>
    </div>
  );
}

export default Settings;