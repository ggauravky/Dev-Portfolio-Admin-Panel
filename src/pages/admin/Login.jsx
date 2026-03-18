import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email.trim(), password.trim());
      localStorage.setItem("adminToken", data.token);
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email.trim());
      }
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Animated background gradients */}
      <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-cyan-600/30 blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl animate-pulse"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.15),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.2),transparent_40%)]"></div>

      {/* Portfolio Link - Top Right */}
      <div className="absolute top-0 right-0 z-20 p-4 md:p-8">
        <a
          href="https://ggauravky.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 hover:border-cyan-400/50 text-slate-200 hover:text-cyan-300 transition-all duration-300 backdrop-blur-sm group"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="text-sm font-medium">View Portfolio</span>
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden border border-slate-800/50 shadow-2xl bg-slate-900/80 backdrop-blur-xl hover:border-slate-700 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
          {/* Left Panel - Gradient */}
          <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-cyan-700 via-blue-700 to-indigo-800 relative overflow-hidden">
            {/* Animated background shapes */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-pulse"></div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl animate-pulse delay-1000"></div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/20 hover:bg-white/25 text-xs font-semibold tracking-wide uppercase transition-colors">
                <div className="w-2 h-2 rounded-full bg-cyan-200 animate-pulse"></div>
                Portfolio Admin
              </div>
              <h1 className="mt-6 text-4xl font-bold leading-tight">
                Control panel for leads, subscriptions, and AI chat analytics.
              </h1>
              <p className="mt-4 text-cyan-100 leading-relaxed">
                Sign in to monitor visitor activity and manage inbound conversations in real time. Track bookings, manage emails, and analyze AI chat metrics.
              </p>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-3 text-sm">
              <InfoTile label="Contacts" value="Inbox triage" icon="📧" />
              <InfoTile label="Bookings" value="Service tracking" icon="📅" />
              <InfoTile label="AI Chats" value="Conversation logs" icon="💬" />
              <InfoTile label="Security" value="Token protected" icon="🔒" />
            </div>
          </div>

          {/* Right Panel - Login Form */}
          <div className="p-8 md:p-10 bg-slate-900/90 backdrop-blur-sm">
            <div className="max-w-md mx-auto">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white">Sign In</h2>
                    <p className="text-slate-400 text-sm">Admin credentials required</p>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-6 rounded-xl border border-red-800/50 bg-red-900/30 px-4 py-3 text-red-200 text-sm flex items-start gap-3 animate-in shake">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-semibold">Login failed</p>
                    <p className="text-red-100">{error}</p>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Input */}
                <div className="group">
                  <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-slate-800 focus:border-cyan-500 transition-all duration-200"
                    placeholder="admin@portfolio.com"
                    required
                  />
                </div>

                {/* Password Input */}
                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Password
                    </label>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-slate-800 focus:border-cyan-500 transition-all duration-200"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 checked:bg-cyan-500 checked:border-cyan-500 cursor-pointer"
                    />
                    <span className="text-slate-400 group-hover:text-slate-300 transition-colors">Remember me</span>
                  </label>
                  <a href="#" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                    Forgot password?
                  </a>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-200 flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Access Admin Panel</span>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-slate-800">
                <p className="text-center text-xs text-slate-500 mb-3">
                  Authorized access only. Session is secured with JWT authentication.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href="https://ggauravky.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-all duration-200 group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span>Visit Portfolio</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile info - shown only on small screens */}
        <div className="absolute bottom-4 left-4 right-4 lg:hidden z-10">
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-800 p-4">
            <p className="text-xs text-slate-400 text-center">
              📧 Contacts • 📅 Bookings • 💬 AI Chats • 🔒 Secure
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoTile = ({ label, value, icon }) => (
  <div className="rounded-xl bg-white/10 border border-white/20 hover:border-white/40 px-3 py-3 transition-all duration-300 hover:bg-white/15 group cursor-pointer">
    <div className="flex items-center justify-between">
      <div className="text-xs uppercase tracking-wide text-cyan-100">{label}</div>
      <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
    </div>
    <div className="font-semibold text-white mt-1 text-sm">{value}</div>
  </div>
);

export default Login;
