import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";

// Safeguard against unhandled DOMExceptions when AudioContext is suspended or resumed while closed
if (typeof window !== "undefined") {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (AudioContextClass && AudioContextClass.prototype) {
    const originalSuspend = AudioContextClass.prototype.suspend;
    if (typeof originalSuspend === "function") {
      AudioContextClass.prototype.suspend = function suspend() {
        if (this.state === "closed") {
          return Promise.resolve();
        }
        return originalSuspend.call(this).catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "InvalidStateError") {
            return Promise.resolve();
          }
          throw err;
        });
      };
    }

    const originalResume = AudioContextClass.prototype.resume;
    if (typeof originalResume === "function") {
      AudioContextClass.prototype.resume = function resume() {
        if (this.state === "closed") {
          return Promise.resolve();
        }
        return originalResume.call(this).catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "InvalidStateError") {
            return Promise.resolve();
          }
          throw err;
        });
      };
    }
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
