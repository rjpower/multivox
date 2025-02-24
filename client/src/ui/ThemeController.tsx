import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

export const ThemeController = () => {
  return (
    <label className="swap swap-rotate btn btn-ghost btn-sm">
      <input type="checkbox" className="theme-controller" value="dark" />
      <SunIcon className="swap-off w-5 h-5" />
      <MoonIcon className="swap-on w-5 h-5" />
    </label>
  );
};
