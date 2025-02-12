import { useAppStore } from "./store";

export const LanguageSelector = ({ className = "" }: { className?: string }) => {
  const languages = useAppStore((state) => state.languages);
  const selectedLanguage = useAppStore((state) => state.selectedLanguage);
  const setSelectedLanguage = useAppStore((state) => state.setSelectedLanguage);

  return (
    <select
      value={selectedLanguage}
      onChange={(e) => setSelectedLanguage(e.target.value)}
      className={className}
    >
      <option value="" disabled>Select a language</option>
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
};
