import { LanguageSelectorProps } from "./types";
import { useStore } from "./store";

export const LanguageSelector = ({ value, onChange, className = "" }: LanguageSelectorProps) => {
  const languages = useStore(state => state.languages);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
};
