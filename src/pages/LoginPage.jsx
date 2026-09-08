import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Wrench, KeyRound, Eye, EyeOff, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function LoginPage() {
  const { login, isAuthed } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthed) navigate('/', { replace: true });
  }, [isAuthed, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      triggerError('يرجى كتابة كود الدخول');
      return;
    }

    setIsLoading(true);
    try {
      await login(code.trim());
      navigate('/', { replace: true });
    } catch (err) {
      triggerError(err.message || 'كود الدخول غير صحيح، حاول مرة أخرى');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerError = (msg) => {
    setError(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  // Settings require auth (see SettingsContext), and this screen runs
  // before login — a static title is used here rather than exposing shop
  // info through an unauthenticated endpoint just for this cosmetic label.
  const shopTitle = 'نظام إدارة المحل';

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-slate-950 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] font-sans text-slate-100 antialiased selection:bg-primary selection:text-white">
      <Helmet>
        <title>تسجيل الدخول — {shopTitle}</title>
        <meta name="description" content="تسجيل الدخول لنظام إدارة المحل وقطع الغيار" />
      </Helmet>

      {/* خلفية التوهج البلوري - Ambient Mesh Background */}
      <div className="pointer-events-none absolute -top-40 -start-40 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -end-40 h-96 w-96 rounded-full bg-blue-600/15 blur-[120px]" />

      {/* الحاوية الرئيسية - Main Card Container */}
      <div className="relative z-10 w-full max-w-md">
        <div
          className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 sm:p-10 ${
            isShaking ? 'animate-shake border-destructive/50' : ''
          }`}
        >
          {/* شريط الإضاءة العلوي Decorative Border Gradient */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

          {/* رأس الكارت - Header Section */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-500 text-white shadow-xl shadow-primary/30 ring-4 ring-white/5">
              <Wrench size={28} className="transition-transform duration-500 hover:rotate-45" />
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white">{shopTitle}</h1>
            <p className="mt-1 text-xs font-medium text-slate-400">نظام الإدارة والتحكم الكامل بالمخزون</p>
          </div>

          {/* نموذج الدخول - Form Section */}
          <form onSubmit={submit} className="grid gap-5">
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-semibold tracking-wide text-slate-300">
                <span>كود الدخول الحصري</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <ShieldCheck size={13} className="text-emerald-500" /> مشفر آمن
                </span>
              </label>

              <div className="relative group">
                <div className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
                  <KeyRound size={18} />
                </div>

                <input
                  type={showCode ? 'text' : 'password'}
                  inputMode="numeric"
                  className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/60 ps-11 pe-11 text-center font-mono text-lg tracking-widest text-white placeholder-slate-600 outline-none transition-all duration-200 focus:border-primary focus:bg-slate-950/80 focus:ring-4 focus:ring-primary/20"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••"
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                  title={showCode ? 'إخفاء' : 'إظهار'}
                >
                  {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* رسالة الخطأ */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-red-400 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* زر تسجيل الدخول */}
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary font-bold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary/90 hover:shadow-primary/40 active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowLeft size={18} className="transition-transform duration-300 group-hover:-translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;