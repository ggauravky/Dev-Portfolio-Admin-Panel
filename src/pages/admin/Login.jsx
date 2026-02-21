import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email.trim(), password.trim());
      localStorage.setItem("adminToken", data.token);
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-cyan-600/30 blur-3xl"></div>
      <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.15),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.2),transparent_40%)]"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/80 backdrop-blur-xl">
          <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-cyan-700 via-blue-700 to-indigo-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold tracking-wide uppercase">
                Portfolio Admin
              </div>
              <h1 className="mt-6 text-4xl font-bold leading-tight">
                Control panel for leads, subscriptions, and AI chat analytics.
              </h1>
              <p className="mt-4 text-cyan-100">
                Sign in to monitor visitor activity and manage inbound conversations in real time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoTile label="Contacts" value="Inbox triage" />
              <InfoTile label="Newsletter" value="Subscriber health" />
              <InfoTile label="AI Chats" value="Conversation logs" />
              <InfoTile label="Security" value="Token protected" />
            </div>
          </div>

          <div className="p-8 md:p-10 bg-slate-900/90">
            <div className="max-w-md mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white">Sign In</h2>
                <p className="text-slate-400 mt-2">Use admin credentials to access the dashboard.</p>
              </div>

              {error && (
                <div className="mb-6 rounded-xl border border-red-800/50 bg-red-900/30 px-4 py-3 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="admin@portfolio.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 font-semibold text-white hover:from-cyan-600 hover:to-blue-700 disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Access Admin Panel"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-slate-500">
                Authorized access only. Session is secured with JWT authentication.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoTile = ({ label, value }) => (
  <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-3">
    <div className="text-xs uppercase tracking-wide text-cyan-100">{label}</div>
    <div className="font-semibold text-white mt-1">{value}</div>
  </div>
);

export default Login;
