import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import { useDarkMode } from "../stores/app";

export const ThemeController = () => {
  const [darkMode, setDarkMode] = useDarkMode();
  console.log("darkMode", darkMode);
  return (
    <label className="swap swap-rotate btn btn-ghost btn-sm">
      <input
        type="checkbox"
        className="theme-controller"
        value={darkMode ? "dark" : "light"}
        onChange={() => setDarkMode(!darkMode)}
      />
      <SunIcon className="swap-off w-5 h-5" />
      <MoonIcon className="swap-on w-5 h-5" />
    </label>
  );
};
