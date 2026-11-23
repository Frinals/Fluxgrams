import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [step, setStep] = useState(0); // 0, 1, 2 - онбординг. 3 - форма
  const [isLogin, setIsLogin] = useState(false);
  
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

  // Данные для экранов знакомства
  const slides = [
    {
      title: "Flux",
      subtitle: "Мессенджер нового поколения",
      desc: "Быстрый, красивый и безопасный. Общайся с теми, кто тебе важен.",
      emoji: "💬",
      color: "#667eea"
    },
    {
      title: "Шифрование",
      subtitle: "Твои данные в безопасности",
      desc: "Все сообщения защищены. Никто, кроме вас двоих, не прочитает их.",
      emoji: "🛡️",
      color: "#2ecc71"
    },
    {
      title: "Юзернеймы",
      subtitle: "Найди любого за секунду",
      desc: "Создай свой уникальный @никнейм. По нему друзья смогут найти тебя в поиске.",
      emoji: "🔍",
      color: "#f39c12"
    }
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-[#0f1115]">
      
      {/* Цветной фон, который меняется */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-1000 opacity-20" 
        style={{ backgroundColor: step < 3 ? slides[step].color : '#ff6b6b' }} 
      />

      <div className="w-full max-w-md p-6 relative z-10">
        
        <AnimatePresence mode="wait">
          
          {/* ЭКРАНЫ ЗНАКОМСТВА */}
          {step < 3 && (
            <motion.div
              key={`slide-${step}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-32 h-32 rounded-[40px] flex items-center justify-center text-6xl shadow-2xl mb-8 bg-white/10 border border-white/20">
                {slides[step].emoji}
              </div>
              
              <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-white">
                {slides[step].title}
              </h1>
              <h2 className="text-xl font-semibold mb-4" style={{ color: slides[step].color }}>
                {slides[step].subtitle}
              </h2>
              <p className="text-base leading-relaxed mb-12 text-gray-400">
                {slides[step].desc}
              </p>

              <div className="w-full flex gap-4">
                <button 
                  onClick={() => setStep(3)} 
                  className="flex-1 py-4 rounded-2xl font-bold text-lg transition-transform active:scale-95 bg-white/10 text-white"
                >
                  Пропустить
                </button>
                <button 
                  onClick={() => setStep(step + 1)} 
                  className="flex-[2] py-4 rounded-2xl font-bold text-lg text-white transition-transform active:scale-95 shadow-lg"
                  style={{ backgroundColor: slides[step].color }}
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
              className="p-8 rounded-[32px] shadow-2xl bg-white/5 border border-white/10 backdrop-blur-md"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2 text-white">
                  {isLogin ? 'С возвращением' : 'Создать аккаунт'}
                </h2>
                <p className="text-sm text-gray-400">
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
                    className="w-full px-5 py-4 rounded-2xl outline-none border border-white/10 bg-black/20 text-white placeholder-gray-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
                    required
                    className="w-full px-5 py-4 rounded-2xl outline-none border border-white/10 bg-black/20 text-white placeholder-gray-500 focus:border-blue-500 transition-all"
                  />
                </div>

                {error && <p className="text-red-500 text-sm text-center font-medium bg-red-500/10 p-3 rounded-xl">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95 disabled:opacity-50 mt-4 shadow-lg bg-blue-500 hover:bg-blue-600"
                >
                  {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
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
