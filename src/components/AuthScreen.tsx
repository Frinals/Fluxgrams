import { useState, FormEvent, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function AuthScreen() {
  const { signIn, signUp, verifyOtp, resendOtp, needsEmailVerification, user } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const pendingEmail = user?.email || email;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!username.trim() || !displayName.trim()) {
        setError('Please enter a username and display name.');
        return;
      }
    }

    setLoading(true);

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, username, displayName);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
    // If needsVerification is true, the needsEmailVerification state will flip
    // and the OTP screen will show automatically
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError(null);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = pasted.split('');
      while (newOtp.length < 6) newOtp.push('');
      setOtp(newOtp);
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setOtpError(t('invalidCode'));
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    const { error } = await verifyOtp(pendingEmail, code);
    if (error) {
      setOtpError(error);
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const { error } = await resendOtp(pendingEmail);
    if (!error) {
      setResendCooldown(30);
      setOtp(['', '', '', '', '', '']);
      setOtpError(null);
      otpRefs.current[0]?.focus();
    }
  };

  const inputStyle = {
    background: 'var(--app-surface)',
    borderColor: 'var(--app-border)',
    color: 'var(--app-text)',
  };

  // ─── OTP Verification Screen ───
  if (needsEmailVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
           style={{ background: 'var(--app-bg-gradient)' }}>
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-[120px] animate-pulse"
             style={{ background: 'var(--app-accent)', top: '-15%', left: '-10%' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px] animate-pulse"
             style={{ background: 'var(--app-glow)', bottom: '-10%', right: '-5%', animationDelay: '1.5s' }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="relative z-10 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...springTransition, delay: 0.1 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 backdrop-blur-2xl border shadow-lg"
              style={{ background: 'var(--app-glass)', borderColor: 'var(--app-border-glass)' }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--app-accent)' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </motion.div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>
              {t('verifyEmail')}
            </h1>
            <p className="mt-3 text-sm" style={{ color: 'var(--app-text-muted)' }}>
              {t('otpSent')}
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: 'var(--app-accent)' }}>
              {pendingEmail}
            </p>
          </div>

          <div className="rounded-3xl p-8 backdrop-blur-2xl border shadow-2xl"
               style={{ background: 'var(--app-glass)', borderColor: 'var(--app-border-glass)' }}>
            <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-xl outline-none transition-all border backdrop-blur-sm"
                  style={{
                    ...inputStyle,
                    borderColor: digit ? 'var(--app-accent)' : 'var(--app-border)',
                    boxShadow: digit ? '0 0 12px var(--app-glow)' : 'none',
                  }}
                />
              ))}
            </div>

            {otpError && (
              <div className="text-sm rounded-xl p-3 border mb-4 text-center" style={{
                background: 'rgba(239,68,68,0.1)',
                borderColor: 'rgba(239,68,68,0.3)',
                color: '#ef4444',
              }}>
                {otpError}
              </div>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={otpLoading}
              className="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--app-accent)', color: '#fff' }}
            >
              {otpLoading ? '...' : t('verify')}
            </button>

            <div className="mt-4 text-center">
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-sm hover:underline transition-all disabled:opacity-50"
                style={{ color: 'var(--app-text-muted)' }}
              >
                {resendCooldown > 0 ? `${t('resendCode')} (${resendCooldown}s)` : t('resendCode')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Sign In / Sign Up Screen ───
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
         style={{ background: 'var(--app-bg-gradient)' }}>
      <div className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-[120px] animate-pulse"
           style={{ background: 'var(--app-accent)', top: '-15%', left: '-10%' }} />
      <div className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px] animate-pulse"
           style={{ background: 'var(--app-glow)', bottom: '-10%', right: '-5%', animationDelay: '1.5s' }} />
      <div className="absolute w-[300px] h-[300px] rounded-full opacity-15 blur-[80px] animate-pulse"
           style={{ background: 'var(--app-accent)', top: '40%', right: '20%', animationDelay: '0.8s' }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 backdrop-blur-2xl border shadow-lg"
               style={{ background: 'var(--app-glass)', borderColor: 'var(--app-border-glass)' }}>
            <span className="text-3xl font-bold" style={{ color: 'var(--app-accent)' }}>F</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>
            Fluxgram
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--app-text-muted)' }}>
            {mode === 'signin' ? t('welcome') : t('createAccount')}
          </p>
        </div>

        <div className="rounded-3xl p-8 backdrop-blur-2xl border shadow-2xl"
             style={{ background: 'var(--app-glass)', borderColor: 'var(--app-border-glass)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--app-text-muted)' }}>
                    {t('displayName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none transition-all border backdrop-blur-sm"
                    style={inputStyle}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--app-text-muted)' }}>
                    {t('username')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }}>@</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      className="w-full pl-8 pr-4 py-3 rounded-xl outline-none transition-all border backdrop-blur-sm"
                      style={inputStyle}
                      placeholder="username"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--app-text-muted)' }}>
                {t('email')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none transition-all border backdrop-blur-sm"
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--app-text-muted)' }}>
                {t('password')}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none transition-all border backdrop-blur-sm"
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm rounded-xl p-3 border" style={{
                background: 'rgba(239,68,68,0.1)',
                borderColor: 'rgba(239,68,68,0.3)',
                color: '#ef4444',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{
                background: 'var(--app-accent)',
                color: '#fff',
              }}
            >
              {loading ? '...' : (mode === 'signin' ? t('signIn') : t('signUp'))}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="text-sm hover:underline transition-all"
              style={{ color: 'var(--app-text-muted)' }}
            >
              {mode === 'signin' ? t('noAccount') : t('haveAccount')}{' '}
              <span className="font-semibold" style={{ color: 'var(--app-accent)' }}>
                {mode === 'signin' ? t('signUp') : t('signIn')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
