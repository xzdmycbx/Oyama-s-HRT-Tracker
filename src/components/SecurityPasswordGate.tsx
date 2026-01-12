import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { useSecurityPassword } from '../contexts/SecurityPasswordContext';
import NumericKeypad from './NumericKeypad';

const SecurityPasswordGate: React.FC = () => {
  const { t } = useTranslation();
  const { hasSecurityPassword, isVerified, isAutoVerifying, verifySecurityPassword } = useSecurityPassword();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const verifyingRef = useRef(false); // Prevent concurrent verifications

  useEffect(() => {
    if (!isVerified) {
      setIsSuccess(false);
    }
  }, [isVerified]);

  useEffect(() => {
    if (hasSecurityPassword === null || hasSecurityPassword === false) {
      setPassword('');
      setError('');
      setIsVerifying(false);
      setIsSuccess(false);
      verifyingRef.current = false;
    }
  }, [hasSecurityPassword]);

  // Handle verify with deduplication
  const handleVerify = useCallback(async (pwd: string) => {
    // Prevent concurrent verifications
    if (verifyingRef.current || isVerifying) {
      return;
    }

    if (pwd.length !== 6) {
      return; // Not ready yet
    }

    setError('');
    setIsSuccess(false);
    setIsVerifying(true);
    verifyingRef.current = true;

    try {
      const result = await verifySecurityPassword(pwd);

      if (result.success) {
        // Show success feedback briefly
        setIsSuccess(true);
        setPassword('');

        // Gate will auto-close when isVerified becomes true
      } else {
        // Handle different error types
        const errorMessage = result.error || t('auth.error.invalidPassword') || 'Invalid password';

        // Check for rate limiting error
        if (errorMessage.includes('Too many requests') || errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
          setError(t('security.error.rateLimited') || 'Too many attempts. Please wait 5 minutes and try again.');
        } else {
          setError(errorMessage);
        }

        setPassword(''); // Clear password on error
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(t('common.error') || 'An error occurred');
      setPassword('');
    } finally {
      setIsVerifying(false);
      verifyingRef.current = false;
    }
  }, [isVerifying, verifySecurityPassword, t]);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (password.length === 6 && !isVerifying && !verifyingRef.current) {
      handleVerify(password);
    }
  }, [password, isVerifying, handleVerify]);

  // Handle number press
  const handleNumberPress = useCallback((num: number) => {
    if (password.length < 6 && !isVerifying) {
      setError(''); // Clear error when user starts typing again
      setPassword(prev => prev + num.toString());
    }
  }, [password.length, isVerifying]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!isVerifying) {
      setError(''); // Clear error when user deletes
      setPassword(prev => prev.slice(0, -1));
    }
  }, [isVerifying]);

  // Don't show gate if:
  // - Security password status not loaded yet (null)
  // - User doesn't have security password (false)
  // - Already verified (isVerified = true)
  // - Currently auto-verifying from cookie (don't flash the UI)
  if (hasSecurityPassword === null || hasSecurityPassword === false || isVerified || isAutoVerifying) {
    return null;
  }

  // Show modal gate - iPhone lock screen style
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl z-[9999] flex items-center justify-center px-4 py-6 sm:p-6 safe-area-inset overflow-y-auto">
      <div className="w-full max-w-sm mx-auto my-auto animate-fade-in">
        {/* Icon */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 sm:mb-6 transition-all duration-500 ${
              isSuccess
                ? 'bg-green-500/20 ring-4 ring-green-500/30'
                : error
                ? 'bg-red-500/20 ring-4 ring-red-500/30 animate-shake'
                : 'bg-pink-500/20 ring-4 ring-pink-500/30'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 size={32} className="sm:w-10 sm:h-10 text-green-400 animate-scale-in" strokeWidth={2.5} />
            ) : (
              <Lock
                size={32}
                className={`sm:w-10 sm:h-10 transition-colors duration-300 ${error ? 'text-red-400' : 'text-pink-400'}`}
                strokeWidth={2.5}
              />
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-1 sm:mb-2 px-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif' }}>
            {isSuccess
              ? (t('common.success') || '验证成功')
              : (t('security.gate.title') || '输入安全密码')
            }
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-gray-400 text-center max-w-xs mb-6 sm:mb-8 px-6" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif' }}>
            {isSuccess
              ? (t('security.gate.success') || '正在加载您的数据...')
              : (t('security.gate.description') || '输入您的6位PIN以访问加密数据')
            }
          </p>
        </div>

        {!isSuccess && (
          <>
            {/* Password Dots Display */}
            <div className="flex justify-center gap-2.5 sm:gap-4 mb-6 sm:mb-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={`
                    w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded-full
                    transition-all duration-200
                    ${index < password.length
                      ? error
                        ? 'bg-red-400 scale-110'
                        : 'bg-white scale-110'
                      : 'bg-white/20'
                    }
                  `}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 sm:mb-6 animate-shake px-2">
                <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-2xl p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle size={18} className="sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <p className="text-xs sm:text-sm text-red-300 flex-1 leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif' }}>
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isVerifying && (
              <div className="mb-4 sm:mb-6 px-2">
                <div className="bg-pink-500/10 backdrop-blur-sm border border-pink-500/30 rounded-2xl p-3 sm:p-4">
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
                    <span className="text-xs sm:text-sm text-pink-300" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif' }}>
                      {t('common.loading') || '验证中...'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* iPhone-style Numeric Keypad */}
            <div className="mb-4 sm:mb-6">
              <NumericKeypad
                onNumberPress={handleNumberPress}
                onDelete={handleDelete}
                disabled={isVerifying}
              />
            </div>

            {/* Hints */}
            <div className="text-[10px] sm:text-xs text-gray-500 text-center space-y-1 sm:space-y-1.5 px-6" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif' }}>
              <p>{t('security.gate.hint1') || '此密码用于加密云端数据'}</p>
              <p>{t('security.gate.hint2') || '每次会话只需输入一次'}</p>
            </div>
          </>
        )}

        {/* Success State */}
        {isSuccess && (
          <div className="flex flex-col items-center py-6 sm:py-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-green-400/30 border-t-green-400 rounded-full animate-spin mb-3 sm:mb-4" />
            <p className="text-xs sm:text-sm text-green-400 px-4 text-center" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif' }}>
              {t('security.gate.success') || '正在加载您的数据...'}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }

        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .animate-shake {
          animation: shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }

        .animate-scale-in {
          animation: scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .safe-area-inset {
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
};

export default SecurityPasswordGate;
