import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [step, setStep] = useState(0); // 0, 1, 2 - знакомство. 3 - вход
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

  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f1115] text-white">
        <div className="text-6xl mb-6">💬</div>
        <h1 className="text-3xl font-bold mb-4">Flux</h1>
        <p className="text-center text-gray-400 mb-8 max-w-sm">Мессенджер нового поколения. Быстрый, красивый и безопасный.</p>
        <button onClick={() => setStep(1)} className="w-full max-w-xs py-4 bg-blue-500 rounded-xl font-bold">Далее</button>
        <button onClick={() => setStep(3)} className="mt-4 text-gray-400">Пропустить</button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f1115] text-white">
        <div className="text-6xl mb-6">🛡️</div>
        <h1 className="text-3xl font-bold mb-4">Шифрование</h1>
        <p className="text-center text-gray-400 mb-8 max-w-sm">Все сообщения защищены. Никто, кроме вас двоих, не прочитает их.</p>
        <button onClick={() => setStep(2)} className="w-full max-w-xs py-4 bg-blue-500 rounded-xl font-bold">Далее</button>
        <button onClick={() => setStep(3)} className="mt-4 text-gray-400">Пропустить</button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f1115] text-white">
        <div className="text-6xl mb-6">🔍</div>
        <h1 className="text-3xl font-bold mb-4">Юзернеймы</h1>
        <p className="text-center text-gray-400 mb-8 max-w-sm">Создай свой уникальный @никнейм. По нему друзья смогут найти тебя.</p>
        <button onClick={() => setStep(3)} className="w-full max-w-xs py-4 bg-blue-500 rounded-xl font-bold">Начать</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f1115] text-white">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-6 text-center">{isLogin ? 'Вход' : 'Регистрация'}</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 bg-black/20 border border-white/10 rounded-xl outline-none text-white" />
          <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 bg-black/20 border border-white/10 rounded-xl outline-none text-white" />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-500 rounded-xl font-bold">
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-4 text-sm text-gray-400">
          {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  );
}
