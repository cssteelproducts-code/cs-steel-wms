import { createContext, useContext, useState, useCallback } from 'react';
import translations from '../translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'th');

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };

  const t = useCallback((key) => {
    return translations[lang]?.[key] ?? translations['th']?.[key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
