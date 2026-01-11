import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import apiClient from '../api/client';
import { Users, ArrowLeft, Plus, Trash2, UserPlus, UserCheck } from 'lucide-react';

interface Authorization {
  viewer_username: string;
  created_at: string;
}

const AccountAuthorizations: React.FC = () => {
  const { t } = useTranslation();
  const { showDialog } = useDialog();
  const [grantedAuthorizations, setGrantedAuthorizations] = useState<Authorization[]>([]);
  const [receivedAuthorizations, setReceivedAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewerUsername, setViewerUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAuthorizations();
  }, []);

  const loadAuthorizations = async () => {
    setLoading(true);

    const [grantedResponse, receivedResponse] = await Promise.all([
      apiClient.getGrantedAuthorizations(),
      apiClient.getReceivedAuthorizations(),
    ]);

    if (grantedResponse.success && grantedResponse.data) {
      setGrantedAuthorizations(grantedResponse.data);
    }
    if (receivedResponse.success && receivedResponse.data) {
      setReceivedAuthorizations(receivedResponse.data);
    }

    setLoading(false);
  };

  const handleCreateAuthorization = async () => {
    setError('');

    if (!viewerUsername || !authPassword) {
      setError(t('authorizations.fillAllFields') || 'Please fill all fields');
      return;
    }

    const response = await apiClient.createAuthorization({
      viewer_username: viewerUsername,
      password: authPassword,
    });

    if (response.success && response.data) {
      setShowCreateModal(false);
      setViewerUsername('');
      setAuthPassword('');
      showDialog('alert', `${t('authorizations.created') || 'Authorization created for'} ${viewerUsername}`);
      loadAuthorizations();
    } else {
      setError(response.error || 'Failed to create authorization');
    }
  };

  const handleRevokeAuthorization = (viewerUsername: string) => {
    showDialog('confirm', `${t('authorizations.revokeConfirm') || 'Revoke authorization for'} ${viewerUsername}?`, async () => {
      const response = await apiClient.revokeAuthorization(viewerUsername);
      if (response.success) {
        showDialog('alert', t('authorizations.revoked') || 'Authorization revoked');
        loadAuthorizations();
      } else {
        showDialog('alert', response.error || 'Failed to revoke authorization');
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/account" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={24} className="text-pink-500" />
              {t('authorizations.title') || 'Authorizations'}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Create Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition font-medium"
        >
          <Plus size={18} />
          {t('authorizations.create') || 'Grant Authorization'}
        </button>

        {/* Granted Authorizations */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-2">
            {t('authorizations.granted') || 'Granted to Others'}
          </h2>
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <p className="text-gray-500">{t('common.loading') || 'Loading...'}</p>
            </div>
          ) : grantedAuthorizations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <p className="text-gray-500">{t('authorizations.noGranted') || 'No authorizations granted'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {grantedAuthorizations.map((auth) => (
                <div key={auth.viewer_username} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
                      <UserPlus size={20} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 text-sm">
                          {auth.viewer_username}
                        </span>
                        <button
                          onClick={() => handleRevokeAuthorization(auth.viewer_username)}
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('authorizations.grantedAt') || 'Granted at'}: {new Date(auth.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Received Authorizations */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-2">
            {t('authorizations.received') || 'Received from Others'}
          </h2>
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <p className="text-gray-500">{t('common.loading') || 'Loading...'}</p>
            </div>
          ) : receivedAuthorizations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <p className="text-gray-500">{t('authorizations.noReceived') || 'No authorizations received'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {receivedAuthorizations.map((auth) => (
                <div key={auth.viewer_username} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                      <UserCheck size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-sm mb-1">
                        {auth.viewer_username}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('authorizations.receivedAt') || 'Received at'}: {new Date(auth.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Authorization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {t('authorizations.createNew') || 'Grant Authorization'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('authorizations.createDesc') || 'Allow another user to view your data'}
            </p>

            <input
              type="text"
              value={viewerUsername}
              onChange={(e) => setViewerUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 mb-3"
              placeholder={t('authorizations.username') || 'Username'}
            />

            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 mb-4"
              placeholder={t('authorizations.yourPassword') || 'Your security password'}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setViewerUsername('');
                  setAuthPassword('');
                  setError('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium"
              >
                {t('btn.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreateAuthorization}
                className="flex-1 px-4 py-3 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition font-medium"
              >
                {t('btn.create') || 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountAuthorizations;
