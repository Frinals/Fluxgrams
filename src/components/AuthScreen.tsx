import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [step, setStep] = useState(0); // 0, 1, 2 - онбординг. 3 - регистрация
  const [isLogin, setIsLogin] = useState(false);
  
  // Стейты для формы
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Успешная регистрация! Теперь вы можете войти.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  // Данные для экранов онбординга
  const slides = [
    {
      title: "Flux",
      subtitle: "Мессенджер нового поколения",
      desc: "Быстрый, красивый и безопасный. Общайся с теми, кто тебе важен.",
      emoji: "💬",
      color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    },
    {
      title: "Шифрование",
      subtitle: "Твои данные в безопасности",
      desc: "Все сообщения защищены сквозным шифрованием. Никто, кроме вас двоих, не прочитает их.",
      emoji: "🛡️",
      color: "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)"
    },
    {
      title: "Юзернеймы",
      subtitle: "Найди любого за секунду",
      desc: "Создай свой уникальный @никнейм. По нему друзья смогут найти тебя в поиске.",
      emoji: "🔍",
      color: "linear-gradient(135deg, #f39c12 0%, #d35400 100%)"
    }
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      
      {/* Анимированный фон */}
      <div className="absolute inset-0 pointer-events-none transition-all duration-1000" 
           style={{ background: step < 3 ? slides[step].color : 'var(--app-accent)', opacity: 0.15 }} />

      <div className="w-full max-w-md p-6 relative z-10">
        
        <AnimatePresence mode="wait">
          
          {/* ЭКРАНЫ ОНБОРДИНГА */}
          {step < 3 && (
            <motion.div
              key={`slide-${step}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-32 h-32 rounded-[40px] flex items-center justify-center text-6xl shadow-2xl mb-8 glass-panel"
                   style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                {slides[step].emoji}
              </div>
              
              <h1 className="text-4xl font-extrabold mb-2 tracking-tight" style={{ color: 'var(--app-text)' }}>
                {slides[step].title}
              </h1>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--app-accent)' }}>
                {slides[step].subtitle}
              </h2>
              <p className="text-base leading-relaxed mb-12" style={{ color: 'var(--app-text-muted)' }}>
                {slides[step].desc}
              </p>

              <div className="w-full flex gap-4">
                <button 
                  onClick={() => setStep(3)} 
                  className="flex-1 py-4 rounded-2xl font-bold text-lg transition-transform active:scale-95"
                  style={{ background: 'var(--app-surface)', color: 'var(--app-text)' }}
                >
                  Пропустить
                </button>
                <button 
                  onClick={() => setStep(step + 1)} 
                  className="flex-[2] py-4 rounded-2xl font-bold text-lg text-white transition-transform active:scale-95 shadow-lg"
                  style={{ background: 'var(--app-accent)' }}
                >
                  Далее
                </button>
              </div>

              {/* Точки-индикаторы */}
              <div className="flex gap-2 mt-8">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`h-2 rounded-full transition-all duration-300 ${step === i ? 'w-8 bg-white' : 'w-2 bg-white/30'}`} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ФОРМА ВХОДА/РЕГИСТРАЦИИ */}
          {step === 3 && (
            <motion.div
              key="auth-form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass-panel p-8 rounded-[32px] shadow-2xl"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--app-text)' }}>
                  {isLogin ? 'С возвращением' : 'Создать аккаунт'}
                </h2>
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                  {isLogin ? 'Войдите, чтобы продолжить общение' : 'Присоединяйтесь к Flux сегодня'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Электронная почта"
                    required
                    className="w-full px-5 py-4 rounded-2xl outline-none border transition-all focus:border-blue-500"
                    style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
                    required
                    className="w-full px-5 py-4 rounded-2xl outline-none border transition-all focus:border-blue-500"
                    style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>

                {error && <p className="text-red-500 text-sm text-center font-medium bg-red-500/10 p-3 rounded-xl">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95 disabled:opacity-50 mt-4 shadow-lg"
                  style={{ background: 'var(--app-accent)' }}
                >
                  {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm font-medium transition-colors hover:text-white"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
