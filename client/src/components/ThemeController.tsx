import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import { useDarkMode } from "../stores/app";
import { useEffect, useState } from "react";
import { Toast } from "./Toast";

export const ThemeController = () => {
  const [darkMode, setDarkMode] = useDarkMode();
  const [showToast, setShowToast] = useState(false);
  
  // Apply theme to HTML element when darkMode changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  
  return (
    <>
      {showToast && (
        <Toast 
          message={darkMode ? "Dark mode enabled" : "Light mode enabled"} 
          type="success"
          onClose={() => setShowToast(false)}
        />
      )}
      <label className="swap swap-rotate btn btn-ghost btn-sm">
      <input
        type="checkbox"
        className="theme-controller"
        checked={darkMode}
        onChange={() => {
          setDarkMode(!darkMode);
          setShowToast(true);
        }}
      />
      <SunIcon className="swap-off w-5 h-5" />
      <MoonIcon className="swap-on w-5 h-5" />
    </label>
    </>
  );
};
