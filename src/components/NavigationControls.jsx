import React, { useState } from "react";

const NavigationControls = ({ onViewReset, onZoomIn, onZoomOut, onRotate }) => {
  const [showRotateMenu, setShowRotateMenu] = useState(false);

  return (
    <div className="navigation-controls">
      <button
        className="nav-btn"
        title="Reset View"
        onClick={onViewReset}
        aria-label="Reset view"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M12 6V3L8 7l4 4V8c2.8 0 5 2.2 5 5 0 2.8-2.2 5-5 5s-5-2.2-5-5H5c0 4.4 3.6 8 8 8s8-3.6 8-8c0-4.4-3.6-8-8-8z"
            fill="#333"
          />
        </svg>
      </button>

      <button
        className="nav-btn"
        title="Zoom In"
        onClick={onZoomIn}
        aria-label="Zoom in"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2h5z" fill="#333" />
        </svg>
      </button>

      <button
        className="nav-btn"
        title="Zoom Out"
        onClick={onZoomOut}
        aria-label="Zoom out"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path d="M6 11h12v2H6z" fill="#333" />
        </svg>
      </button>

      <div className="nav-btn-group">
        <button
          className="nav-btn"
          title="Rotate View"
          onClick={() => setShowRotateMenu(!showRotateMenu)}
          aria-label="Rotate view"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M12 2v2a8 8 0 1 1-7.75 10.53L2 14.28A10 10 0 1 0 12 2z"
              fill="#333"
            />
          </svg>
        </button>

        {showRotateMenu && (
          <div className="rotate-menu">
            <button
              onClick={() => {
                onRotate("left");
                setShowRotateMenu(false);
              }}
            >
              Left
            </button>
            <button
              onClick={() => {
                onRotate("right");
                setShowRotateMenu(false);
              }}
            >
              Right
            </button>
            <button
              onClick={() => {
                onRotate("up");
                setShowRotateMenu(false);
              }}
            >
              Up
            </button>
            <button
              onClick={() => {
                onRotate("down");
                setShowRotateMenu(false);
              }}
            >
              Down
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationControls;
