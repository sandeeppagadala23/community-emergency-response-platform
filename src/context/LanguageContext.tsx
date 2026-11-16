import React, { createContext, useContext, useState } from 'react';

export type Language = 'en' | 'hi' | 'kn';

interface Translations {
  sosButton: string;
  sosHolding: string;
  emergencyCategory: string;
  addNoteOptional: string;
  locationReady: string;
  locationGetting: string;
  locationUnavailable: string;
  turnOnLocation: string;
  callEmergencyServices: string;
  alertRecorded: string;
  myIncidents: string;
  notifications: string;
  simulatedEnvironment: string;
  signOut: string;
}

const DICTIONARY: Record<Language, Translations> = {
  en: {
    sosButton: 'Hold to send SOS',
    sosHolding: 'Keep holding to send...',
    emergencyCategory: 'Emergency category',
    addNoteOptional: 'Add a note (optional)',
    locationReady: 'Location ready (accuracy about 12 m)',
    locationGetting: 'Getting location…',
    locationUnavailable: 'Location unavailable. Alert can still be sent.',
    turnOnLocation: 'Turn on location',
    callEmergencyServices: 'Call emergency services (112)',
    alertRecorded: 'Your alert has been recorded',
    myIncidents: 'My incidents',
    notifications: 'Notifications',
    simulatedEnvironment: 'This is a test environment. No real messages were sent.',
    signOut: 'Sign out',
  },
  hi: {
    sosButton: 'SOS भेजने के लिए दबाकर रखें',
    sosHolding: 'भेजने के लिए दबाए रखें...',
    emergencyCategory: 'आपातकालीन श्रेणी',
    addNoteOptional: 'एक नोट जोड़ें (वैकल्पिक)',
    locationReady: 'स्थान तैयार है (सटीकता लगभग 12 मीटर)',
    locationGetting: 'स्थान प्राप्त किया जा रहा है…',
    locationUnavailable: 'स्थान उपलब्ध नहीं है। अलर्ट फिर भी भेजा जा सकता है।',
    turnOnLocation: 'स्थान चालू करें',
    callEmergencyServices: 'आपातकालीन सेवाओं को कॉल करें (112)',
    alertRecorded: 'आपका अलर्ट दर्ज कर लिया गया है',
    myIncidents: 'मेरी घटनाएँ',
    notifications: 'सूचनाएं',
    simulatedEnvironment: 'यह एक परीक्षण वातावरण है। कोई वास्तविक संदेश नहीं भेजा गया।',
    signOut: 'साइन आउट',
  },
  kn: {
    sosButton: 'SOS ಕಳುಹಿಸಲು ಹಿಡಿದುಕೊಳ್ಳಿ',
    sosHolding: 'ಕಳುಹಿಸಲು ಹಿಡಿದುಕೊಳ್ಳಿ...',
    emergencyCategory: 'ತುರ್ತು ವರ್ಗ',
    addNoteOptional: 'ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ (ಐಚ್ಛಿಕ)',
    locationReady: 'ಸ್ಥಳ ಸಿದ್ಧವಾಗಿದೆ (ನಿಖರತೆ ಸುಮಾರು 12 ಮೀ)',
    locationGetting: 'ಸ್ಥಳವನ್ನು ಪಡೆಯಲಾಗುತ್ತಿದೆ…',
    locationUnavailable: 'ಸ್ಥಳ ಲಭ್ಯವಿಲ್ಲ. ಎಚ್ಚರಿಕೆಯನ್ನು ಇನ್ನೂ ಕಳುಹಿಸಬಹುದು.',
    turnOnLocation: 'ಸ್ಥಳವನ್ನು ಆನ್ ಮಾಡಿ',
    callEmergencyServices: 'ತುರ್ತು ಸೇವೆಗಳಿಗೆ ಕರೆ ಮಾಡಿ (112)',
    alertRecorded: 'ನಿಮ್ಮ ಎಚ್ಚರಿಕೆಯನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ',
    myIncidents: 'ನನ್ನ ಘಟನೆಗಳು',
    notifications: 'ಸೂಚನೆಗಳು',
    simulatedEnvironment: 'ಇದು ಪರೀಕ್ಷಾ ಪರಿಸರವಾಗಿದೆ. ಯಾವುದೇ ನೈಜ ಸಂದೇಶಗಳನ್ನು ಕಳುಹಿಸಲಾಗಿಲ್ಲ.',
    signOut: 'ಸೈನ್ ಔಟ್',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('cerp_lang') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cerp_lang', lang);
  };

  const t = (key: keyof Translations): string => {
    return DICTIONARY[language][key] || DICTIONARY.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
};
