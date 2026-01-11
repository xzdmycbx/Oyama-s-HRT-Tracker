import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation, Lang } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Languages, Upload, Download, Copy, Trash2, Info, Github, AlertTriangle,
  ArrowLeft, Settings as SettingsIcon, User, LogIn, UserPlus
} from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import ImportModal from '../components/ImportModal';
import ExportModal from '../components/ExportModal';
import PasswordDisplayModal from '../components/PasswordDisplayModal';
import PasswordInputModal from '../components/PasswordInputModal';
import DisclaimerModal from '../components/DisclaimerModal';
import { encryptData, decryptData, DoseEvent, LabResult } from '../../logic';
import { APP_VERSION } from '../constants';
import flagCN from '../flag_svg/🇨🇳.svg';
import flagTW from '../flag_svg/🇹🇼.svg';
import flagHK from '../flag_svg/🇭🇰.svg';
import flagUS from '../flag_svg/🇺🇸.svg';
import flagJP from '../flag_svg/🇯🇵.svg';
import flagRU from '../flag_svg/🇷🇺.svg';
import flagUA from '../flag_svg/🇺🇦.svg';
import { v4 as uuidv4 } from 'uuid';

const Settings: React.FC = () => {
  const { t, lang, setLang } = useTranslation();
  const { showDialog } = useDialog();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<DoseEvent[]>(() => {
    const saved = localStorage.getItem('hrt-events');
    return saved ? JSON.parse(saved) : [];
  });
  const [weight, setWeight] = useState<number>(() => {
    const saved = localStorage.getItem('hrt-weight');
    return saved ? parseFloat(saved) : 70.0;
  });
  const [labResults, setLabResults] = useState<LabResult[]>(() => {
    const saved = localStorage.getItem('hrt-lab-results');
    return saved ? JSON.parse(saved) : [];
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isPasswordDisplayOpen, setIsPasswordDisplayOpen] = useState(false);
  const [isPasswordInputOpen, setIsPasswordInputOpen] = useState(false);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [pendingImportText, setPendingImportText] = useState<string | null>(null);

  const languageOptions = useMemo(() => ([
    { value: 'zh', label: '简体中文', icon: <img src={flagCN} alt="CN" className="w-5 h-5 rounded-sm object-contain" /> },
    { value: 'zh-TW', label: '正體中文（中国台湾）', icon: <img src={flagTW} alt="TW" className="w-5 h-5 rounded-sm object-contain" /> },
    { value: 'yue', label: '廣東話', icon: <img src={flagHK} alt="HK" className="w-5 h-5 rounded-sm object-contain" /> },
    { value: 'en', label: 'English', icon: <img src={flagUS} alt="US" className="w-5 h-5 rounded-sm object-contain" /> },
    { value: 'ja', label: '日本語', icon: <img src={flagJP} alt="JP" className="w-5 h-5 rounded-sm object-contain" /> },
    { value: 'ru', label: 'Русский', icon: <img src={flagRU} alt="RU" className="w-5 h-5 rounded-sm object-contain" /> },
    { value: 'uk', label: 'Українська', icon: <img src={flagUA} alt="UA" className="w-5 h-5 rounded-sm object-contain" /> },
  ]), []);

  const sanitizeImportedEvents = (raw: any): DoseEvent[] => {
    if (!Array.isArray(raw)) throw new Error('Invalid format');
    return raw
      .map((item: any) => {
        if (!item || typeof item !== 'object') return null;
        const { route, timeH, doseMG, ester, extras } = item;
        const timeNum = Number(timeH);
        if (!Number.isFinite(timeNum)) return null;
        const doseNum = Number(doseMG);
        const sanitizedExtras = (extras && typeof extras === 'object') ? extras : {};
        return {
          id: typeof item.id === 'string' ? item.id : uuidv4(),
          route,
          timeH: timeNum,
          doseMG: Number.isFinite(doseNum) ? doseNum : 0,
          ester,
          extras: sanitizedExtras
        } as DoseEvent;
      })
      .filter((item): item is DoseEvent => item !== null);
  };

  const sanitizeImportedLabResults = (raw: any): LabResult[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: any) => {
        if (!item || typeof item !== 'object') return null;
        const { timeH, concValue, unit } = item;
        const timeNum = Number(timeH);
        const valNum = Number(concValue);
        if (!Number.isFinite(timeNum) || !Number.isFinite(valNum)) return null;
        const unitVal = unit === 'pg/ml' || unit === 'pmol/l' ? unit : 'pmol/l';
        return {
          id: typeof item.id === 'string' ? item.id : uuidv4(),
          timeH: timeNum,
          concValue: valNum,
          unit: unitVal
        } as LabResult;
      })
      .filter((item): item is LabResult => item !== null);
  };

  const processImportedData = (parsed: any): boolean => {
    try {
      let newEvents: DoseEvent[] = [];
      let newWeight: number | undefined = undefined;
      let newLabs: LabResult[] = [];

      if (Array.isArray(parsed)) {
        newEvents = sanitizeImportedEvents(parsed);
      } else if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed.events)) {
          newEvents = sanitizeImportedEvents(parsed.events);
        }
        if (typeof parsed.weight === 'number' && parsed.weight > 0) {
          newWeight = parsed.weight;
        }
        if (Array.isArray(parsed.labResults)) {
          newLabs = sanitizeImportedLabResults(parsed.labResults);
        }
      }

      if (!newEvents.length && !newWeight && !newLabs.length) throw new Error('No valid entries');

      if (newEvents.length > 0) {
        setEvents(newEvents);
        localStorage.setItem('hrt-events', JSON.stringify(newEvents));
      }
      if (newWeight !== undefined) {
        setWeight(newWeight);
        localStorage.setItem('hrt-weight', newWeight.toString());
      }
      if (newLabs.length > 0) {
        setLabResults(newLabs);
        localStorage.setItem('hrt-lab-results', JSON.stringify(newLabs));
      }

      showDialog('alert', t('drawer.import_success'));
      return true;
    } catch (err) {
      console.error(err);
      showDialog('alert', t('drawer.import_error'));
      return false;
    }
  };

  const importEventsFromJson = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);

      if (parsed.encrypted && parsed.iv && parsed.salt && parsed.data) {
        setPendingImportText(text);
        setIsPasswordInputOpen(true);
        return true;
      }

      return processImportedData(parsed);
    } catch (err) {
      console.error(err);
      showDialog('alert', t('drawer.import_error'));
      return false;
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    if (!pendingImportText) return;
    const decrypted = await decryptData(pendingImportText, password);
    if (decrypted) {
      setIsPasswordInputOpen(false);
      setPendingImportText(null);
      try {
        const parsed = JSON.parse(decrypted);
        processImportedData(parsed);
      } catch (e) {
        showDialog('alert', t('import.decrypt_error'));
      }
    } else {
      showDialog('alert', t('import.decrypt_error'));
    }
  };

  const handleQuickExport = () => {
    if (events.length === 0 && labResults.length === 0) {
      showDialog('alert', t('drawer.empty_export'));
      return;
    }
    const exportData = {
      meta: { version: 1, exportedAt: new Date().toISOString() },
      weight: weight,
      events: events,
      labResults: labResults
    };
    const json = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      showDialog('alert', t('drawer.export_copied'));
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const downloadFile = (data: string, filename: string) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportConfirm = async (encrypt: boolean) => {
    setIsExportModalOpen(false);
    const exportData = {
      meta: { version: 1, exportedAt: new Date().toISOString() },
      weight: weight,
      events: events,
      labResults: labResults
    };
    const json = JSON.stringify(exportData, null, 2);

    if (encrypt) {
      const { data, password } = await encryptData(json);
      setGeneratedPassword(password);
      setIsPasswordDisplayOpen(true);
      downloadFile(data, `hrt-dosages-encrypted-${new Date().toISOString().split('T')[0]}.json`);
    } else {
      downloadFile(json, `hrt-dosages-${new Date().toISOString().split('T')[0]}.json`);
    }
  };

  const handleClearAllEvents = () => {
    if (!events.length) return;
    showDialog('confirm', t('drawer.clear_confirm'), () => {
      setEvents([]);
      localStorage.setItem('hrt-events', JSON.stringify([]));
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <SettingsIcon size={24} className="text-pink-500" />
              {t('nav.settings') || 'Settings'}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* User Info / Login Area */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                <User size={24} className="text-pink-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900">{user?.username}</p>
                <p className="text-xs text-gray-500">{t('account.member') || 'HRT Tracker Member'}</p>
              </div>
              <button
                onClick={() => navigate('/account')}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
              >
                {t('account.title') || 'Account'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">{t('auth.welcome') || 'Welcome'}</h3>
                <p className="text-sm text-gray-500 mt-1">{t('auth.loginPrompt') || 'Login to use cloud sync features'}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition font-medium"
                >
                  <LogIn size={18} />
                  {t('auth.login') || 'Login'}
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium"
                >
                  <UserPlus size={18} />
                  {t('auth.register') || 'Register'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* General Settings */}
        <div className="space-y-2">
          <h3 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            {t('settings.group.general') || 'General'}
          </h3>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Languages className="text-blue-500" size={20} />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{t('drawer.lang')}</p>
                <p className="text-xs text-gray-500">{t('drawer.lang_hint')}</p>
              </div>
              <div className="ml-auto text-xs font-bold text-gray-500">{lang.toUpperCase()}</div>
            </div>
            <CustomSelect
              value={lang}
              onChange={(val) => setLang(val as Lang)}
              options={languageOptions}
            />
          </div>
        </div>

        {/* Data Management */}
        <div className="space-y-2">
          <h3 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            {t('settings.group.data') || 'Data Management'}
          </h3>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-teal-50 transition text-left"
            >
              <Upload className="text-teal-500" size={20} />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{t('import.title')}</p>
                <p className="text-xs text-gray-500">{t('drawer.import_hint')}</p>
              </div>
            </button>

            <button
              onClick={() => {
                if (events.length === 0 && labResults.length === 0) {
                  showDialog('alert', t('drawer.empty_export'));
                  return;
                }
                setIsExportModalOpen(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-pink-50 transition text-left"
            >
              <Download className="text-pink-400" size={20} />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{t('export.title')}</p>
                <p className="text-xs text-gray-500">{t('drawer.save_hint')}</p>
              </div>
            </button>

            <button
              onClick={handleQuickExport}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-blue-50 transition text-left"
            >
              <Copy className="text-blue-400" size={20} />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{t('drawer.export_quick')}</p>
                <p className="text-xs text-gray-500">{t('drawer.export_quick_hint')}</p>
              </div>
            </button>

            <button
              onClick={handleClearAllEvents}
              disabled={!events.length}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left transition ${
                events.length ? 'hover:bg-red-50' : 'bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 className="text-red-400" size={20} />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{t('drawer.clear')}</p>
                <p className="text-xs text-gray-500">{t('drawer.clear_confirm')}</p>
              </div>
            </button>
          </div>
        </div>

        {/* About */}
        <div className="space-y-2">
          <h3 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            {t('settings.group.about') || 'About'}
          </h3>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            <button
              onClick={() => {
                showDialog('confirm', t('drawer.model_confirm'), () => {
                  window.open('https://misaka23323.com/articles/estrogen-model-summary', '_blank');
                });
              }}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-purple-50 transition text-left"
            >
              <Info className="text-purple-500" size={20} />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{t('drawer.model_title')}</p>
                <p className="text-xs text-gray-500">{t('drawer.model_desc')}</p>
              </div>
            </button>

            <button
              onClick={() => {
                showDialog('confirm', t('drawer.github_confirm'), () => {
                  window.open('https://github.com/SmirnovaOyama/Oyama-s-HRT-recorder', '_blank');
                });
              }}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition text-left"
            >
              <Github className="text-gray-700" size={20} />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{t('drawer.github')}</p>
                <p className="text-xs text-gray-500">{t('drawer.github_desc')}</p>
              </div>
            </button>

            <button
              onClick={() => setIsDisclaimerOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-amber-50 transition text-left"
            >
              <AlertTriangle className="text-amber-500" size={20} />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">{t('drawer.disclaimer')}</p>
                <p className="text-xs text-gray-500">{t('drawer.disclaimer_desc')}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Version */}
        <div className="pt-2 pb-4 flex justify-center">
          <p className="text-xs font-medium text-gray-300">{APP_VERSION}</p>
        </div>
      </div>

      {/* Modals */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportJson={importEventsFromJson}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportConfirm}
        events={events}
        labResults={labResults}
        weight={weight}
      />

      <PasswordDisplayModal
        isOpen={isPasswordDisplayOpen}
        onClose={() => setIsPasswordDisplayOpen(false)}
        password={generatedPassword}
      />

      <PasswordInputModal
        isOpen={isPasswordInputOpen}
        onClose={() => setIsPasswordInputOpen(false)}
        onConfirm={handlePasswordSubmit}
      />

      <DisclaimerModal
        isOpen={isDisclaimerOpen}
        onClose={() => setIsDisclaimerOpen(false)}
      />
    </div>
  );
};

export default Settings;
