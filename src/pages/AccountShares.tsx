import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import apiClient from '../api/client';
import type { ShareType } from '../api/types';
import { Share2, ArrowLeft, Plus, Copy, Trash2, Lock, Unlock, Eye, Clock, Zap } from 'lucide-react';

interface Share {
  share_id: string;
  created_at: string;
  view_count: number;
  is_password_protected: boolean;
  is_locked: boolean;
  share_type: ShareType;
}

const AccountShares: React.FC = () => {
  const { t } = useTranslation();
  const { showDialog } = useDialog();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [shareType, setShareType] = useState<ShareType>('copy');
  const [error, setError] = useState('');

  useEffect(() => {
    loadShares();
  }, []);

  const loadShares = async () => {
    setLoading(true);
    const response = await apiClient.getShares();
    if (response.success && response.data) {
      setShares(response.data);
    }
    setLoading(false);
  };

  const handleCreateShare = async () => {
    setError('');
    const response = await apiClient.createShare({
      share_type: shareType,
      password: sharePassword || undefined,
    });

    if (response.success && response.data) {
      setShowCreateModal(false);
      setSharePassword('');
      setShareType('copy');

      const shareUrl = `${window.location.origin}/share/${response.data.share_id}`;
      const shareTypeText = shareType === 'copy'
        ? (t('shares.typeCopy') || '副本分享')
        : (t('shares.typeRealtime') || '实时分享');
      const message = sharePassword
        ? `${shareTypeText}\n${t('shares.shareCreatedWithPassword') || 'Share created! URL copied to clipboard. Password:'} ${sharePassword}\n\n${shareUrl}`
        : `${shareTypeText}\n${t('shares.shareCreated') || 'Share created! URL copied to clipboard:'}\n\n${shareUrl}`;

      navigator.clipboard.writeText(shareUrl);
      showDialog('alert', message);
      loadShares();
    } else {
      setError(response.error || 'Failed to create share');
    }
  };

  const handleCopyShareUrl = (shareId: string) => {
    const url = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard.writeText(url);
    showDialog('alert', t('shares.urlCopied') || 'Share URL copied to clipboard');
  };

  const handleToggleLock = async (shareId: string, currentlyLocked: boolean) => {
    const response = await apiClient.updateShareLock(shareId, {
      is_locked: !currentlyLocked,
    });

    if (response.success) {
      showDialog('alert', currentlyLocked
        ? (t('shares.unlocked') || 'Share unlocked')
        : (t('shares.locked') || 'Share locked'));
      loadShares();
    } else {
      showDialog('alert', response.error || 'Failed to update share');
    }
  };

  const handleDeleteShare = (shareId: string) => {
    showDialog('confirm', t('shares.deleteConfirm') || 'Delete this share?', async () => {
      const response = await apiClient.deleteShare(shareId);
      if (response.success) {
        showDialog('alert', t('shares.deleted') || 'Share deleted');
        loadShares();
      } else {
        showDialog('alert', response.error || 'Failed to delete share');
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
              <Share2 size={24} className="text-pink-500" />
              {t('shares.title') || 'Shares'}
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
          {t('shares.create') || 'Create New Share'}
        </button>

        {/* Shares List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">{t('common.loading') || 'Loading...'}</p>
          </div>
        ) : shares.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">{t('shares.empty') || 'No shares yet'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {shares.map((share) => (
              <div key={share.share_id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    share.share_type === 'realtime' ? 'bg-blue-50' : 'bg-pink-50'
                  }`}>
                    {share.share_type === 'realtime' ? (
                      <Zap size={20} className="text-blue-500" />
                    ) : (
                      <Clock size={20} className="text-pink-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {share.share_id}
                      </code>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        share.share_type === 'realtime'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {share.share_type === 'realtime'
                          ? (t('shares.typeRealtime') || '实时')
                          : (t('shares.typeCopy') || '副本')}
                      </span>
                      {share.is_password_protected && (
                        <Lock size={14} className="text-gray-500" />
                      )}
                      {share.is_locked && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                          {t('shares.locked') || 'Locked'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 space-y-1 mb-3">
                      <div className="flex items-center gap-2">
                        <Eye size={12} />
                        {t('shares.views') || 'Views'}: {share.view_count}
                      </div>
                      <div>
                        {t('shares.created') || 'Created'}: {new Date(share.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleCopyShareUrl(share.share_id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-xs font-medium"
                      >
                        <Copy size={14} />
                        {t('shares.copyUrl') || 'Copy URL'}
                      </button>
                      <button
                        onClick={() => handleToggleLock(share.share_id, share.is_locked)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition text-xs font-medium ${
                          share.is_locked
                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                            : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        }`}
                      >
                        {share.is_locked ? <Unlock size={14} /> : <Lock size={14} />}
                        {share.is_locked ? (t('shares.unlock') || 'Unlock') : (t('shares.lock') || 'Lock')}
                      </button>
                      <button
                        onClick={() => handleDeleteShare(share.share_id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-xs font-medium"
                      >
                        <Trash2 size={14} />
                        {t('shares.delete') || 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Share Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {t('shares.createNew') || 'Create New Share'}
            </h3>

            {/* Share Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('shares.shareType') || '分享类型'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShareType('copy')}
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition ${
                    shareType === 'copy'
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <Clock size={24} className={shareType === 'copy' ? 'text-pink-500' : 'text-gray-400'} />
                  <span className={`text-sm font-medium ${shareType === 'copy' ? 'text-pink-900' : 'text-gray-600'}`}>
                    {t('shares.typeCopy') || '副本分享'}
                  </span>
                  <span className="text-xs text-gray-500 text-center">
                    {t('shares.typeCopyDesc') || '分享当前数据快照'}
                  </span>
                </button>
                <button
                  onClick={() => setShareType('realtime')}
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition ${
                    shareType === 'realtime'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <Zap size={24} className={shareType === 'realtime' ? 'text-blue-500' : 'text-gray-400'} />
                  <span className={`text-sm font-medium ${shareType === 'realtime' ? 'text-blue-900' : 'text-gray-600'}`}>
                    {t('shares.typeRealtime') || '实时分享'}
                  </span>
                  <span className="text-xs text-gray-500 text-center">
                    {t('shares.typeRealtimeDesc') || '始终显示最新数据'}
                  </span>
                </button>
              </div>
            </div>

            {/* Password */}
            <p className="text-sm text-gray-600 mb-2">
              {t('shares.createDesc') || 'Optionally set a password to protect this share'}
            </p>
            <input
              type="password"
              value={sharePassword}
              onChange={(e) => setSharePassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 mb-4"
              placeholder={t('shares.passwordOptional') || 'Password (optional)'}
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
                  setSharePassword('');
                  setShareType('copy');
                  setError('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium"
              >
                {t('btn.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreateShare}
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

export default AccountShares;
