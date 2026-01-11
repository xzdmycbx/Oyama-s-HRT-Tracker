import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Account from '../pages/Account';
import AccountDevices from '../pages/AccountDevices';
import AccountShares from '../pages/AccountShares';
import AccountAuthorizations from '../pages/AccountAuthorizations';
import SettingsPage from '../pages/Settings';
import ShareView from '../pages/ShareView';

// Protected route component
interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<'entering' | 'entered' | 'exiting'>('entered');

  // Page configuration based on route
  const getPageConfig = (pathname: string) => {
    const configs: Record<string, { showBackButton: boolean; centerContent?: boolean }> = {
      '/login': { showBackButton: false, centerContent: true },
      '/register': { showBackButton: false, centerContent: true },
      '/account': { showBackButton: true, centerContent: false },
      '/account/devices': { showBackButton: false, centerContent: false }, // Has own header
      '/account/shares': { showBackButton: false, centerContent: false }, // Has own header
      '/account/authorizations': { showBackButton: false, centerContent: false }, // Has own header
      '/account/settings': { showBackButton: false, centerContent: false }, // Has own header
      '/share/:shareId': { showBackButton: true, centerContent: false },
    };

    // Match dynamic routes
    if (pathname.startsWith('/share/')) {
      return configs['/share/:shareId'];
    }

    return configs[pathname] || { showBackButton: false, centerContent: false };
  };

  const currentConfig = getPageConfig(displayLocation.pathname);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setTransitionStage('exiting');
    }
  }, [location, displayLocation]);

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header - only show if configured */}
      {currentConfig.showBackButton && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900 transition"
                aria-label="Go back"
              >
                <ArrowLeft size={24} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content area with page transition */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            transitionStage === 'exiting'
              ? 'opacity-0 translate-x-4'
              : transitionStage === 'entering'
              ? 'opacity-0 -translate-x-4'
              : 'opacity-100 translate-x-0'
          }`}
          onTransitionEnd={(e) => {
            // Only handle transition end for the wrapper itself, not child elements
            if (e.target !== e.currentTarget) return;

            if (transitionStage === 'exiting') {
              setDisplayLocation(location);
              setTransitionStage('entering');
              // Force a reflow to ensure the transition plays
              setTimeout(() => setTransitionStage('entered'), 10);
            }
          }}
        >
          <div className={`h-full ${
            currentConfig.centerContent
              ? 'flex items-center justify-center overflow-y-auto'
              : 'overflow-y-auto'
          }`}>
            {/* Render routes with the display location */}
            <Routes location={displayLocation}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/account/devices" element={<ProtectedRoute><AccountDevices /></ProtectedRoute>} />
              <Route path="/account/shares" element={<ProtectedRoute><AccountShares /></ProtectedRoute>} />
              <Route path="/account/authorizations" element={<ProtectedRoute><AccountAuthorizations /></ProtectedRoute>} />
              <Route path="/account/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/share/:shareId" element={<ShareView />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
