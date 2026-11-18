import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage, Language } from '../../context/LanguageContext';
import { apiClient } from '../../services/apiClient';
import { User, Moon, Sun, Globe, Palette, Server } from 'lucide-react';

export const DemoBar: React.FC = () => {
  const { role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const isMockMode = apiClient.isMockMode();
  return (
    <aside
      aria-label="Application Controls"
      className="bg-stone-900 text-stone-200 text-xs border-b border-stone-800 px-3 py-1.5 z-40 transition-colors"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Active backend role */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold flex items-center gap-1">
            <User className="w-3 h-3 text-action-light" />
            <span>{role || 'No active session'}</span>
          </span>

          <span className="hidden sm:inline text-stone-500">|</span>

          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-stone-300">
            <Server className="h-3 w-3 text-teal-300" />
            {isMockMode ? 'Local demo data' : 'Django API · Port 8001'}
          </span>
          {isMockMode && (
            <span className="text-amber-300">
              Demo changes are not shared with real accounts.
            </span>
          )}
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2.5">
          {isMockMode && (
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="rounded border border-amber-500/60 px-2 py-0.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/10"
            >
              Sign in to live account
            </button>
          )}
          {/* Design System Reference */}
          <Link
            to="/design-system"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors ${
              location.pathname === '/design-system'
                ? 'bg-stone-800 text-white border-stone-600'
                : 'text-stone-300 hover:text-white border-stone-700 hover:border-stone-500'
            }`}
          >
            <Palette className="w-3 h-3 text-teal-400" />
            <span>Design Tokens</span>
          </Link>

          {/* Language Switcher */}
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-stone-400" />
            <label htmlFor="demo-language-select" className="sr-only">
              Select Interface Language
            </label>
            <select
              id="demo-language-select"
              name="demo-language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              aria-label="Select Interface Language"
              className="bg-stone-800 text-stone-200 text-[11px] px-1 py-0.5 rounded border border-stone-700 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="kn">ಕನ್ನಡ</option>
            </select>
          </div>

          {/* Dark Desk Mode Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Security Desk Dark Mode"
            title="Toggle theme (Light / Dark Security Desk)"
            className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-teal-300" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
