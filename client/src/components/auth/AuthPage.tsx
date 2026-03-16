import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { login, register } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AnimatedCharacters, type CharacterMood } from "./AnimatedCharacters";

export function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mood, setMood] = useState<CharacterMood>("idle");
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const pendingPos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pendingPos.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          setMousePos({ ...pendingPos.current });
          rafRef.current = 0;
        });
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleEmailFocus = () => { setFocusedField("email"); setMood("looking"); };
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setMood("tracking");
    const ratio = Math.min(e.target.value.length / 25, 1);
    setMousePos((p) => ({ ...p, x: ratio }));
  };
  const handlePasswordFocus = () => { setFocusedField("password"); setMood("curious"); };
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (mood !== "curious") setMood("curious");
  };
  const handleBlur = () => { setFocusedField(null); if (!error) setMood("idle"); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setMood("curious");
    try {
      const res = isLogin
        ? await login(email, password)
        : await register(email, password, name);
      setMood("happy");
      setSuccess(true);
      setTimeout(() => { setAuth(res.user, res.token); navigate("/"); }, 800);
    } catch (err: any) {
      setMood("sad");
      setError(err.message || "Something went wrong");
      setTimeout(() => { if (!focusedField) setMood("idle"); }, 2500);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => { setIsLogin(!isLogin); setError(""); setMood("idle"); };

  const inputClass =
    "w-full rounded-xl border border-evo-border bg-white py-2.5 px-3 text-evo-text placeholder-evo-muted outline-none transition-all focus:border-evo-accent focus:ring-2 focus:ring-evo-highlight";

  return (
    <div className="min-h-screen bg-evo-bg flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-[900px] bg-white rounded-[24px] border-2 border-evo-border shadow-xl overflow-hidden flex flex-col md:flex-row"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Left side - Characters */}
        <div className="md:w-[45%] bg-evo-card flex items-end justify-center p-6 pt-10 min-h-[200px] md:min-h-[560px] relative overflow-hidden">
          <div className="w-full max-w-[320px]">
            <AnimatedCharacters mood={mood} mouseX={mousePos.x} mouseY={mousePos.y} />
          </div>
        </div>

        {/* Right side - Form */}
        <div className="md:w-[55%] px-8 md:px-12 py-10 flex flex-col justify-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-evo-accent flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <motion.h1 className="text-[28px] font-bold text-evo-text" layout>
              {isLogin ? "Welcome back!" : "Create account"}
            </motion.h1>
            <p className="mt-1 text-sm text-evo-muted">
              {isLogin ? "Please enter your details" : "Sign up to get started"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="mb-1.5 block text-sm font-medium text-evo-text">Name</label>
                  <input
                    type="text" value={name}
                    onChange={(e) => { setName(e.target.value); setMood("looking"); }}
                    required={!isLogin} placeholder="Your name"
                    className={inputClass}
                    onFocus={() => { setFocusedField("name"); setMood("looking"); }}
                    onBlur={handleBlur}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-evo-text">Email</label>
              <input
                ref={emailRef} type="email" value={email}
                onChange={handleEmailChange} onFocus={handleEmailFocus} onBlur={handleBlur}
                required placeholder="Enter your email"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-evo-text">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"} value={password}
                  onChange={handlePasswordChange} onFocus={handlePasswordFocus} onBlur={handleBlur}
                  required minLength={6} placeholder="••••••••"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-evo-muted hover:text-evo-accent transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-evo-border text-evo-accent focus:ring-evo-accent"
                  />
                  <span className="text-sm text-evo-muted">Remember for 30 days</span>
                </label>
                <button type="button" className="text-sm font-medium text-evo-accent hover:underline transition">
                  Forgot password?
                </button>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600"
                >{error}</motion.p>
              )}
              {success && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600"
                >Welcome! Redirecting...</motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit" disabled={loading || success}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              className="w-full rounded-xl bg-evo-accent py-3 font-semibold text-white transition-colors hover:bg-evo-accent-hover disabled:opacity-60 mt-1"
            >
              <span className="flex items-center justify-center gap-2">
                {loading && <Loader2 size={18} className="animate-spin" />}
                {success && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>✓</motion.span>}
                {isLogin ? "Log in" : "Create Account"}
              </span>
            </motion.button>

            <motion.button
              type="button" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-evo-border bg-white py-3 font-medium text-evo-text transition hover:bg-evo-card"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Log in with Google
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-evo-muted">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={toggleMode} className="font-semibold text-evo-accent hover:underline">
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
