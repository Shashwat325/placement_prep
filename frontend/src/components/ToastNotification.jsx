import React from 'react';
import './ToastNotification.css';

const ToastNotification = ({ message, type = 'info', onClose }) => {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 5000); // Auto hide after 5 seconds

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={`toast toast-${type}`} role="alert">
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={() => {
        setVisible(false);
        onClose && onClose();
      }}>
        ×
      </button>
    </div>
  );
};

export default ToastNotification;