import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'th');

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
