import { useEffect, useState } from "react";
import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

export const Toast = ({ 
  message, 
  type = "success", 
  duration = 3000, 
  onClose 
}: ToastProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const typeClasses = {
    success: "alert-success",
    error: "alert-error",
    warning: "alert-warning",
    info: "alert-info"
  };

  const icons = {
    success: <CheckCircleIcon className="h-6 w-6" />,
    error: <XMarkIcon className="h-6 w-6" />,
    warning: <XMarkIcon className="h-6 w-6" />,
    info: <CheckCircleIcon className="h-6 w-6" />
  };

  return (
    <div className={`alert ${typeClasses[type]} fixed bottom-4 right-4 w-auto max-w-sm z-50 shadow-lg`}>
      <div className="flex items-center gap-2">
        {icons[type]}
        <span>{message}</span>
      </div>
      <button 
        className="btn btn-ghost btn-xs" 
        onClick={() => {
          setVisible(false);
          if (onClose) onClose();
        }}
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

export const useToast = () => {
  const [toasts, setToasts] = useState<Array<{ id: string; props: ToastProps }>>([]);

  const showToast = (props: Omit<ToastProps, 'onClose'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { 
      id, 
      props: {
        ...props,
        onClose: () => {
          setToasts(prev => prev.filter(toast => toast.id !== id));
        }
      } 
    }]);
    return id;
  };

  const ToastContainer = () => (
    <>
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast.props} />
      ))}
    </>
  );

  return { showToast, ToastContainer };
};
