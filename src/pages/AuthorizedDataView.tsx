import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Lock, AlertCircle, Users, Calendar, CheckCircle } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import type { Authorization, ViewAuthorizedDataResponse } from '../api/types';
import type { DoseEvent, LabResult, SimulationResult } from '../../logic';
import { runSimulation, createCalibrationInterpolator } from '../../logic';
import PINInput from '../components/PINInput';
import OverviewView from '../views/OverviewView';
import { getSecurityPassword } from '../utils/crypto';

const AuthorizedDataView: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected authorization to view
  const [selectedAuth, setSelectedAuth] = useState<Authorization | null>(null);
  const [securityPassword, setSecurityPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  // Viewed data
  const [viewedData, setViewedData] = useState<ViewAuthorizedDataResponse | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchAuthorizations();
  }, [isAuthenticated, navigate]);

  // 当显示密码模态框时，自动从 Cookie 读取密码
  useEffect(() => {
    if (selectedAuth && user?.username) {
      getSecurityPassword(user.username).then(pwd => {
        if (pwd) {
          setSecurityPassword(pwd);
        }
      });
    }
  }, [selectedAuth, user]);

  const fetchAuthorizations = async () => {
    setIsLoading(true);
    setError('');

    const response = await apiClient.getReceivedAuthorizations();

    if (response.success && response.data) {
      setAuthorizations(response.data);
    } else {
      setError(response.error || 'Failed to load authorizations');
    }

    setIsLoading(false);
  };

  const handleViewData = async () => {
    if (!selectedAuth || !selectedAuth.owner_username) {
      return;
    }

    if (securityPassword.length !== 6) {
      setUnlockError(t('auth.error.invalidPassword') || 'Password must be 6 digits');
      return;
    }

    setIsUnlocking(true);
    setUnlockError('');

    const response = await apiClient.viewAuthorizedData({
      owner_username: selectedAuth.owner_username,
      password: securityPassword,
    });

    setIsUnlocking(false);

    if (response.success && response.data) {
      setViewedData(response.data);
      setSelectedAuth(null);
      setSecurityPassword('');
    } else {
      setUnlockError(response.error || 'Failed to view data. Check your security password.');
    }
  };

  const handleCloseView = () => {
    setViewedData(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">{t('common.loading') || 'Loading...'}</div>
      </div>
    );
  }

  // If viewing someone's data
  if (viewedData) {
    const { data, owner } = viewedData;
    const events: DoseEvent[] = data.events || [];
    const weight: number = data.weight || 70;
    const labResults: LabResult[] = data.lab_results || [];

    const simulation: SimulationResult | null = events.length > 0 ? runSimulation(events, weight) : null;
    const calibrationFn = createCalibrationInterpolator(simulation, labResults);

    return (
      <div className="w-full h-full flex flex-col overflow-hidden bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                <Eye size={20} className="text-pink-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {owner}'s Data
                </h2>
                <p className="text-xs text-gray-500">
                  {t('auth.readOnly') || 'Read-only view'}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseView}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition text-sm"
            >
              {t('common.close') || 'Close'}
            </button>
          </div>
        </div>

        {/* Data View */}
        <div className="flex-1 overflow-y-auto">
          <OverviewView
            events={events}
            weight={weight}
            labResults={labResults}
            simulation={simulation}
            currentTime={new Date()}
            calibrationFn={calibrationFn}
            onEditEvent={() => {}} // Read-only
            onOpenWeightModal={() => {}} // Read-only
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
              <Users size={24} className="text-pink-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {t('auth.title') || 'Authorized Data'}
              </h2>
              <p className="text-sm text-gray-500">
                {t('auth.subtitle') || 'View data from users who authorized you'}
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl mb-4">
              <AlertCircle size={20} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {authorizations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {t('auth.noAuthorizations') || 'No one has authorized you to view their data yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {authorizations.map((auth, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedAuth(auth)}
                  className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl p-4 transition text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                        <Eye size={18} className="text-pink-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {auth.owner_username || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar size={12} />
                          {t('auth.authorizedOn') || 'Authorized on'}{' '}
                          {new Date(auth.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle size={18} />
            {t('auth.info.title') || 'How it works'}
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 ml-6 list-disc">
            <li>{t('auth.info.1') || 'Click on a user to view their data'}</li>
            <li>{t('auth.info.2') || 'Enter YOUR security password to decrypt their data'}</li>
            <li>{t('auth.info.3') || 'You can only view data, not edit it'}</li>
            <li>{t('auth.info.4') || 'Authorization can be revoked by the owner at any time'}</li>
          </ul>
        </div>
      </div>

      {/* Password Modal */}
      {selectedAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                <Lock size={24} className="text-pink-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t('auth.enterPassword') || 'Enter Your Security Password'}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('auth.viewingData') || `Viewing ${selectedAuth.owner_username}'s data`}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('security.label.password') || 'Security Password'}
              </label>
              <PINInput
                value={securityPassword}
                onChange={setSecurityPassword}
                error={!!unlockError}
                autoFocus
              />
            </div>

            {unlockError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm mb-4">
                <AlertCircle size={18} />
                <span>{unlockError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedAuth(null);
                  setSecurityPassword('');
                  setUnlockError('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-300 transition"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleViewData}
                disabled={isUnlocking || securityPassword.length !== 6}
                className="flex-1 bg-pink-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUnlocking
                  ? (t('common.loading') || 'Loading...')
                  : (t('auth.viewData') || 'View Data')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthorizedDataView;
