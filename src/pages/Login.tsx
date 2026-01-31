import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import Turnstile from '../components/Turnstile';
import { TURNSTILE_SITE_KEY } from '../api/config';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const isMountedRef = useRef(true);
  const hasNavigatedRef = useRef(false);

  // Redirect if already logged in (only on initial mount)
  useEffect(() => {
    if (isAuthenticated && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      navigate('/account', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent concurrent submissions
    if (isLoading) return;

    setError('');

    // Trim inputs
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError(t('login.error.emptyFields') || 'Please fill in all fields');
      return;
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      setError(t('login.error.invalidUsername') || 'Username must be 3-20 characters');
      return;
    }

    if (trimmedPassword.length < 8) {
      setError(t('login.error.invalidPassword') || 'Password must be at least 8 characters');
      return;
    }

    // Check Turnstile token if site key is configured
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError(t('login.error.captcha') || 'Please complete the verification');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(trimmedUsername, trimmedPassword, turnstileToken || undefined);

      if (!isMountedRef.current) return;

      if (result.success) {
        hasNavigatedRef.current = true;
        navigate('/', { replace: true });
      } else {
        // Generic error message to prevent user enumeration
        setError(t('login.error.failed') || 'Invalid username or password');
        // Reset Turnstile on error
        if (TURNSTILE_SITE_KEY) {
          setTurnstileToken('');
          setTurnstileKey(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      if (!isMountedRef.current) return;
      setError(t('login.error.network') || 'Network error. Please try again.');
      // Reset Turnstile on error
      if (TURNSTILE_SITE_KEY) {
        setTurnstileToken('');
        setTurnstileKey(prev => prev + 1);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="w-full min-h-full flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-pink-50 via-white to-blue-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-5 sm:p-6 border border-gray-200">
          <div className="text-center mb-5 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
              {t('login.title') || 'Sign In'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {t('login.subtitle') || 'Welcome back to HRT Tracker'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('login.username') || 'Username'}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                placeholder={t('login.usernamePlaceholder') || 'Enter your username'}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('login.password') || 'Password'}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                placeholder={t('login.passwordPlaceholder') || 'Enter your password'}
                disabled={isLoading}
              />
            </div>

            {TURNSTILE_SITE_KEY && (
              <Turnstile
                key={turnstileKey}
                action="login"
                onSuccess={(token) => {
                  setTurnstileToken(token);
                  setError(''); // Clear any previous captcha errors
                }}
                onError={() => {
                  setTurnstileToken('');
                  setError(t('login.error.captchaFailed') || 'Verification failed. Please try again.');
                }}
                onExpired={() => {
                  setTurnstileToken('');
                  setError(t('login.error.captchaExpired') || 'Verification expired. Please verify again.');
                }}
              />
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-900 text-white py-2.5 sm:py-3 px-4 rounded-lg sm:rounded-xl font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isLoading ? (t('login.loading') || 'Signing in...') : (t('login.submit') || 'Sign In')}
            </button>
          </form>

          <div className="mt-4 sm:mt-5 text-center">
            <p className="text-xs sm:text-sm text-gray-600">
              {t('login.noAccount') || "Don't have an account?"}{' '}
              <Link to="/register" className="text-pink-600 hover:text-pink-700 font-medium transition">
                {t('login.register') || 'Sign Up'}
              </Link>
            </p>
          </div>

          <div className="mt-3 sm:mt-4 text-center">
            <Link to="/" className="text-gray-500 hover:text-gray-700 text-xs sm:text-sm transition">
              {t('login.continueWithout') || 'Continue without account'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
