import React, { useEffect } from "react";
import "./Settings.css";

// Fontawesome Icons
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

   // Remove the disabled inputs styling if host changes 
   if (props.isHost) {
     var disabled_inputs = document.getElementsByClassName("disable");
     while (disabled_inputs.length > 0) {
       disabled_inputs[0].disabled = false;
       disabled_inputs[0].classList.remove("disable");
     }
   }
 }, [props.isHost]);

 const onInputChange = (event) => {
   const value = parseInt(event.target.value) || 0;
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
       /> $
     </label>
   </div>
 );
}

export default Settings;