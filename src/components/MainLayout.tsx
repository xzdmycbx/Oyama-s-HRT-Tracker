import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Settings, Plus, Activity, Calendar, FlaskConical, User, LogOut } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { useAppData } from '../contexts/AppDataContext';
import { formatDate, formatTime } from '../utils/helpers';
import { DoseEvent, LabResult } from '../../logic';

import WeightEditorModal from './WeightEditorModal';
import DoseFormModal from './DoseFormModal';
import LabResultModal from './LabResultModal';

const MainLayout: React.FC = () => {
    const { t, lang } = useTranslation();
    const { showDialog } = useDialog();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, user, logout } = useAuth();
    const { events, setEvents, weight, setWeight, labResults, setLabResults, currentTime } = useAppData();

    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<DoseEvent | null>(null);
    const [isLabModalOpen, setIsLabModalOpen] = useState(false);
    const [editingLab, setEditingLab] = useState<LabResult | null>(null);

    const [showUserMenu, setShowUserMenu] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const mainScrollRef = useRef<HTMLDivElement>(null);

    type ViewKey = 'home' | 'history' | 'lab' | 'settings';
    const currentView = location.pathname === '/' ? 'home' : location.pathname.slice(1) as ViewKey;

    const handleViewChange = (view: ViewKey) => {
        const routes: Record<ViewKey, string> = {
            home: '/',
            history: '/history',
            lab: '/lab',
            settings: '/settings',
        };
        navigate(routes[view]);
    };

    // Lock body scroll when modals are open
    useEffect(() => {
        const shouldLock = isWeightModalOpen || isFormOpen || isLabModalOpen;
        document.body.style.overflow = shouldLock ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isWeightModalOpen, isFormOpen, isLabModalOpen]);

    // Reset scroll when switching tabs
    useEffect(() => {
        const el = mainScrollRef.current;
        if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    }, [location.pathname]);

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };

        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showUserMenu]);

    // Fetch user avatar when authenticated
    useEffect(() => {
        if (isAuthenticated && user?.username) {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
            const avatarPath = `${baseUrl}/api/avatars/${user.username}`;

            // Set avatar URL (browser caching handles the actual caching)
            setAvatarUrl(avatarPath);
            setAvatarError(false);
        } else {
            setAvatarUrl(null);
            setAvatarError(false);
        }
    }, [isAuthenticated, user]);

    const navItems = [
        { id: 'home' as ViewKey, label: t('nav.home'), icon: <Activity size={16} /> },
        { id: 'history' as ViewKey, label: t('nav.history'), icon: <Calendar size={16} /> },
        { id: 'lab' as ViewKey, label: t('nav.lab'), icon: <FlaskConical size={16} /> },
        { id: 'settings' as ViewKey, label: t('nav.settings'), icon: <Settings size={16} /> },
    ];

    const handleAddEvent = () => {
        setEditingEvent(null);
        setIsFormOpen(true);
    };

    const handleEditEvent = (e: DoseEvent) => {
        setEditingEvent(e);
        setIsFormOpen(true);
    };

    const handleAddLabResult = () => {
        setEditingLab(null);
        setIsLabModalOpen(true);
    };

    const handleEditLabResult = (res: LabResult) => {
        setEditingLab(res);
        setIsLabModalOpen(true);
    };

    const handleDeleteLabResult = (id: string) => {
        showDialog('confirm', t('lab.delete_confirm'), () => {
            setLabResults(prev => prev.filter(r => r.id !== id));
        });
    };

    const handleClearLabResults = () => {
        if (!labResults.length) return;
        showDialog('confirm', t('lab.clear_confirm'), () => {
            setLabResults([]);
        });
    };

    const handleSaveEvent = (e: DoseEvent) => {
        setEvents(prev => {
            const exists = prev.find(p => p.id === e.id);
            if (exists) {
                return prev.map(p => p.id === e.id ? e : p);
            }
            return [...prev, e];
        });
    };

    const handleDeleteEvent = (id: string) => {
        showDialog('confirm', t('timeline.delete_confirm'), () => {
            setEvents(prev => prev.filter(e => e.id !== id));
        });
    };

    return (
        <div className="h-screen w-full bg-white flex flex-col font-sans text-gray-900 select-none overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden w-full bg-white shadow-xl shadow-gray-900/10">
                {/* Top navigation for tablet/desktop */}
                <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 bg-white">
                            <img src="/favicon.ico" alt="HRT Tracker logo" className="w-full h-full object-cover" />
                        </div>
                        <div className="leading-tight">
                            <p className="text-base font-black tracking-tight text-gray-900">HRT Tracker</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 justify-center flex-1">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleViewChange(item.id)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition ${
                                    currentView === item.id
                                        ? 'bg-gray-900 text-white border-gray-900'
                                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:text-gray-900'
                                }`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2.5 rounded-full border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 flex items-center gap-3">
                            <span>{formatDate(currentTime, lang)}</span>
                            <span className="text-gray-300">·</span>
                            <span className="font-mono text-gray-900">{formatTime(currentTime)}</span>
                        </div>
                        <button
                            onClick={handleAddEvent}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition"
                        >
                            <Plus size={16} />
                            <span>{t('btn.add')}</span>
                        </button>

                        {/* User Menu */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="w-10 h-10 rounded-full border-2 border-gray-200 hover:border-pink-500 transition flex items-center justify-center bg-white overflow-hidden"
                            >
                                {isAuthenticated && avatarUrl && !avatarError ? (
                                    <img
                                        src={avatarUrl}
                                        alt="User avatar"
                                        className="w-full h-full object-cover"
                                        onError={() => setAvatarError(true)}
                                    />
                                ) : (
                                    <User size={20} className="text-gray-600" />
                                )}
                            </button>

                            {showUserMenu && (
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                                    {isAuthenticated ? (
                                        <>
                                            <div className="px-4 py-3 border-b border-gray-100">
                                                <p className="text-sm font-bold text-gray-900">{t('nav.account')}</p>
                                                <p className="text-xs text-gray-500 mt-1">{t('account.member')}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigate('/account');
                                                    setShowUserMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                                            >
                                                <User size={16} />
                                                {t('account.title')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    logout();
                                                    setShowUserMenu(false);
                                                    navigate('/');
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                                            >
                                                <LogOut size={16} />
                                                {t('auth.logout') || 'Logout'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="px-4 py-3 border-b border-gray-100">
                                                <p className="text-sm font-bold text-gray-900">{t('auth.welcome')}</p>
                                                <p className="text-xs text-gray-500 mt-1">{t('auth.loginPrompt')}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigate('/login');
                                                    setShowUserMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                                            >
                                                {t('auth.login')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    navigate('/register');
                                                    setShowUserMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                                            >
                                                {t('auth.register')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main content area with page transitions */}
                <div
                    ref={mainScrollRef}
                    key={location.pathname}
                    className="flex-1 flex flex-col overflow-y-auto scrollbar-hide"
                    style={{
                        animation: 'fadeIn 0.3s ease-in-out'
                    }}
                >
                    <Outlet context={{
                        onEditEvent: handleEditEvent,
                        onOpenWeightModal: () => setIsWeightModalOpen(true),
                        onAddEvent: handleAddEvent,
                        onAddLabResult: handleAddLabResult,
                        onEditLabResult: handleEditLabResult,
                        onClearLabResults: handleClearLabResults
                    }} />
                </div>
                <style>{`
                    @keyframes fadeIn {
                        from {
                            opacity: 0;
                            transform: translateX(8px);
                        }
                        to {
                            opacity: 1;
                            transform: translateX(0);
                        }
                    }
                `}</style>

                {/* Bottom Navigation - mobile only */}
                <nav className="px-4 pb-4 pt-2 bg-transparent z-20 safe-area-pb shrink-0 md:hidden">
                    <div className="w-full bg-white/70 backdrop-blur-lg border border-white/40 rounded-3xl px-3 py-3 flex items-center justify-between gap-2">
                        <button
                            onClick={() => handleViewChange('home')}
                            className={`flex-1 flex flex-col items-center gap-1 rounded-2xl py-2 transition-all border-2 ${
                                currentView === 'home'
                                    ? 'bg-white text-[#8a3459] border-[#f6c4d7]'
                                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                            }`}
                        >
                            <Activity size={22} className={currentView === 'home' ? 'text-[#f6c4d7]' : ''} />
                            <span className="text-[11px] font-semibold">{t('nav.home')}</span>
                        </button>
                        <button
                            onClick={() => handleViewChange('history')}
                            className={`flex-1 flex flex-col items-center gap-1 rounded-2xl py-2 transition-all border-2 ${
                                currentView === 'history'
                                    ? 'bg-white text-[#8a3459] border-[#f6c4d7]'
                                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                            }`}
                        >
                            <Calendar size={22} className={currentView === 'history' ? 'text-[#f6c4d7]' : ''} />
                            <span className="text-[11px] font-semibold">{t('nav.history')}</span>
                        </button>
                        <button
                            onClick={() => handleViewChange('lab')}
                            className={`flex-1 flex flex-col items-center gap-1 rounded-2xl py-2 transition-all border-2 ${
                                currentView === 'lab'
                                    ? 'bg-white text-[#0f766e] border-teal-200'
                                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                            }`}
                        >
                            <FlaskConical size={22} className={currentView === 'lab' ? 'text-[#0f766e]' : ''} />
                            <span className="text-[11px] font-semibold">{t('nav.lab')}</span>
                        </button>
                        {isAuthenticated ? (
                            <button
                                onClick={() => navigate('/account')}
                                className="flex-1 flex flex-col items-center gap-1 rounded-2xl py-2 transition-all border-2 text-gray-500 hover:text-gray-700 border-transparent"
                            >
                                <User size={22} />
                                <span className="text-[11px] font-semibold">{t('nav.account') || '我的'}</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => handleViewChange('settings')}
                                className={`flex-1 flex flex-col items-center gap-1 rounded-2xl py-2 transition-all border-2 ${
                                    currentView === 'settings'
                                        ? 'bg-white text-gray-900 border-gray-300'
                                        : 'text-gray-500 hover:text-gray-700 border-transparent'
                                }`}
                            >
                                <Settings size={22} className={currentView === 'settings' ? 'text-pink-500' : ''} />
                                <span className="text-[11px] font-semibold">{t('nav.settings')}</span>
                            </button>
                        )}
                    </div>
                </nav>
            </div>

            {/* Modals */}
            <WeightEditorModal
                isOpen={isWeightModalOpen}
                onClose={() => setIsWeightModalOpen(false)}
                currentWeight={weight}
                onSave={setWeight}
            />

            <DoseFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                eventToEdit={editingEvent}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
            />

            <LabResultModal
                isOpen={isLabModalOpen}
                onClose={() => setIsLabModalOpen(false)}
                onSave={(res) => {
                    setLabResults(prev => {
                        const exists = prev.find(r => r.id === res.id);
                        if (exists) {
                            return prev.map(r => r.id === res.id ? res : r);
                        }
                        return [...prev, res];
                    });
                }}
                onDelete={(id) => {
                    showDialog('confirm', t('lab.delete_confirm'), () => {
                        setLabResults(prev => prev.filter(r => r.id !== id));
                    });
                }}
                resultToEdit={editingLab}
            />
        </div>
    );
};

export default MainLayout;
