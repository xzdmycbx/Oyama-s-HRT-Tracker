import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { DialogProvider } from './contexts/DialogContext';
import { AppDataProvider } from './contexts/AppDataContext';
import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/MainLayout';
import SecurityPasswordGate from './components/SecurityPasswordGate';
import OverviewPage from './pages/OverviewPage';
import HistoryPage from './pages/HistoryPage';
import LabPage from './pages/LabPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';
import AccountDevices from './pages/AccountDevices';
import AccountShares from './pages/AccountShares';
import AccountAuthorizations from './pages/AccountAuthorizations';
import AccountSettings from './pages/Settings';
import SecurityPassword from './pages/SecurityPassword';
import AuthorizedDataView from './pages/AuthorizedDataView';
import ShareView from './pages/ShareView';

// Protected route component
interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const App = () => (
    <LanguageProvider>
        <DialogProvider>
            <AppDataProvider>
                <SecurityPasswordGate />
                <Routes>
                    {/* All routes use MainLayout for unified layout */}
                    <Route element={<MainLayout />}>
                        {/* Main app pages */}
                        <Route index element={<OverviewPage />} />
                        <Route path="history" element={<HistoryPage />} />
                        <Route path="lab" element={<LabPage />} />
                        <Route path="settings" element={<SettingsPage />} />

                        {/* Auth pages */}
                        <Route path="login" element={<Login />} />
                        <Route path="register" element={<Register />} />

                        {/* Account pages - protected */}
                        <Route path="account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
                        <Route path="account/devices" element={<ProtectedRoute><AccountDevices /></ProtectedRoute>} />
                        <Route path="account/shares" element={<ProtectedRoute><AccountShares /></ProtectedRoute>} />
                        <Route path="account/authorizations" element={<ProtectedRoute><AccountAuthorizations /></ProtectedRoute>} />
                        <Route path="account/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
                        <Route path="account/security" element={<ProtectedRoute><SecurityPassword /></ProtectedRoute>} />
                        <Route path="account/authorized-data" element={<ProtectedRoute><AuthorizedDataView /></ProtectedRoute>} />

                        {/* Share view */}
                        <Route path="share/:shareId" element={<ShareView />} />
                    </Route>
                </Routes>
            </AppDataProvider>
        </DialogProvider>
    </LanguageProvider>
);

export default App;
