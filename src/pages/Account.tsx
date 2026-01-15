import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { useTranslation } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import { User, Smartphone, Share2, LogOut, Settings, Cloud, Camera, Trash2, Key, Lock } from 'lucide-react';
import apiClient from '../api/client';

const Account: React.FC = () => {
  const { user, logout } = useAuth();
  const { isSyncing, lastSyncTime, syncError } = useCloudSync();
  const { t } = useTranslation();
  const { showDialog } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now());

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const managementItemClass = 'flex items-center gap-3 px-4 py-4 transition';
  const managementLinkClass = `${managementItemClass} hover:bg-gray-50`;

  const handleLogout = async () => {
    const choice = await showDialog('confirm',
      t('account.logoutConfirm') || 'Do you want to keep your local data?',
      {
        confirmText: t('account.keepData') || 'Keep Local Data',
        cancelText: t('account.clearData') || 'Clear All Data',
        thirdOption: t('common.cancel') || 'Cancel'
      }
    );

    if (choice === 'third') {
      // User cancelled - do nothing
      return;
    }

    // 'confirm' = Keep Data (false), 'cancel' = Clear Data (true)
    const clearData = choice === 'cancel';
    await logout(clearData);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showDialog('alert', t('account.avatarTooLarge') || 'Avatar file too large (max 5MB)');
      return;
    }

    // Check file type
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      showDialog('alert', t('account.invalidImageType') || 'Invalid image type (PNG, JPEG, or GIF only)');
      return;
    }

    setUploadingAvatar(true);
    const response = await apiClient.uploadAvatar(file);
    setUploadingAvatar(false);

    if (response.success && response.data) {
      showDialog('alert', t('account.avatarUploaded') || 'Avatar uploaded successfully');
      // Force reload avatar by updating key
      setAvatarKey(Date.now());
    } else {
      showDialog('alert', response.error || 'Failed to upload avatar');
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = () => {
    showDialog('confirm', t('account.deleteAvatarConfirm') || 'Delete your avatar?', async () => {
      const response = await apiClient.deleteAvatar();
      if (response.success) {
        showDialog('alert', t('account.avatarDeleted') || 'Avatar deleted successfully');
        setAvatarKey(Date.now());
      } else {
        showDialog('alert', response.error || 'Failed to delete avatar');
      }
    });
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('account.passwordRequired') || 'All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('account.passwordTooShort') || 'New password must be at least 8 characters');
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError(t('account.passwordComplexity') || 'Password must contain at least one letter and one number');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('account.passwordMismatch') || 'Passwords do not match');
      return;
    }

    if (oldPassword === newPassword) {
      setPasswordError(t('account.passwordSame') || 'New password cannot be the same as old password');
      return;
    }

    setChangingPassword(true);
    const response = await apiClient.changePassword({
      old_password: oldPassword,
      new_password: newPassword,
    });
    setChangingPassword(false);

    if (response.success && response.data) {
      showDialog('alert',
        `${t('account.passwordChanged') || 'Password changed successfully'}\n${t('account.otherSessionsLoggedOut') || 'Other sessions logged out'}: ${response.data.other_sessions_logged_out}`
      );
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordError(response.error || 'Failed to change password');
    }
  };

  return (
    <div className="bg-gray-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* User Info with Avatar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center overflow-hidden">
                {user?.username ? (
                  <>
                    <img
                      key={avatarKey}
                      src={`${apiClient.getAvatarUrl(user.username)}?t=${avatarKey}`}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to User icon if avatar fails to load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <User size={32} className="text-pink-600 hidden" />
                  </>
                ) : (
                  <User size={32} className="text-pink-600" />
                )}
              </div>
              <button
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
              >
                <Camera size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{user?.username}</h2>
              <p className="text-sm text-gray-500">{t('account.member') || 'HRT Tracker Member'}</p>
            </div>
            <button
              onClick={handleDeleteAvatar}
              className="text-red-500 hover:text-red-700 transition"
              title={t('account.deleteAvatar') || 'Delete Avatar'}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Cloud Sync Status */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cloud size={20} className="text-blue-500" />
            <h3 className="font-bold text-gray-900">{t('account.cloudSync') || 'Cloud Sync'}</h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t('account.status') || 'Status'}:</span>
              <span className={`font-medium ${isSyncing ? 'text-blue-600' : 'text-green-600'}`}>
                {isSyncing ? (t('account.syncing') || 'Syncing...') : (t('account.synced') || 'Synced')}
              </span>
            </div>
            {lastSyncTime && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('account.lastSync') || 'Last Sync'}:</span>
                <span className="text-gray-900">{new Date(lastSyncTime).toLocaleString()}</span>
              </div>
            )}
            {syncError && (
              <div className="text-red-600 text-xs mt-2">{syncError}</div>
            )}
            <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              {t('account.autoSyncNote') || 'Local changes upload in real time; cloud data is pulled every 3 seconds'}
            </div>
          </div>
        </div>

        {/* Management */}
        <div className="space-y-2">
          <h3 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            {t('account.management') || 'Management'}
          </h3>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            <Link
              to="/account/devices"
              className={managementLinkClass}
            >
              <Smartphone size={20} className="text-gray-600" />
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">{t('account.devices') || 'Devices'}</p>
                <p className="text-xs text-gray-500">{t('account.devicesDesc') || 'Manage logged in devices'}</p>
              </div>
            </Link>

            <Link
              to="/account/shares"
              className={managementLinkClass}
            >
              <Share2 size={20} className="text-gray-600" />
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">{t('account.shares') || 'Shares'}</p>
                <p className="text-xs text-gray-500">{t('account.sharesDesc') || 'Manage data shares'}</p>
              </div>
            </Link>


            <Link
              to="/account/security"
              className={managementLinkClass}
            >
              <Lock size={20} className="text-gray-600" />
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">{t('account.securityPassword') || 'Security Password'}</p>
                <p className="text-xs text-gray-500">{t('account.securityPasswordDesc') || 'Manage 6-digit PIN for data encryption'}</p>
              </div>
            </Link>

            <Link
              to="/account/settings"
              className={managementLinkClass}
            >
              <Settings size={20} className="text-gray-600" />
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">{t('account.settings') || 'Settings'}</p>
                <p className="text-xs text-gray-500">{t('account.settingsDesc') || 'App preferences'}</p>
              </div>
            </Link>


            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition w-full text-left"
            >
              <Key size={20} className="text-gray-600" />
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">{t('account.changePassword') || 'Change Password'}</p>
                <p className="text-xs text-gray-500">{t('account.changePasswordDesc') || 'Update your login password'}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-red-600 hover:bg-red-50 transition font-medium"
        >
          <LogOut size={18} />
          {t('account.logout') || 'Logout'}
        </button>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Key size={24} className="text-pink-500" />
              {t('account.changePassword') || 'Change Password'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.oldPassword') || 'Old Password'}
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder={t('account.oldPasswordPlaceholder') || 'Enter old password'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.newPassword') || 'New Password'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder={t('account.newPasswordPlaceholder') || 'Enter new password (8+ chars)'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.confirmPassword') || 'Confirm Password'}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder={t('account.confirmPasswordPlaceholder') || 'Confirm new password'}
                />
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">
                  {passwordError}
                </div>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                <p>• {t('account.passwordRequirement1') || 'At least 8 characters'}</p>
                <p>• {t('account.passwordRequirement2') || 'Contains at least one letter and one number'}</p>
                <p>• {t('account.passwordWarning') || 'All other devices will be logged out'}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError('');
                }}
                disabled={changingPassword}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('btn.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="flex-1 px-4 py-3 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingPassword ? (t('account.changing') || 'Changing...') : (t('btn.confirm') || 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
