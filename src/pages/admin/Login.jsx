import { useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuth";
import { intendedDestination } from "../../routes/workspace";
import { PortfolioLink } from "../../components/layout/Identity";
import { Button, Field, Icon, InlineAlert, SkipLink, heading } from "../../components/ui/Primitives";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  const { signIn, status, message } = useAdminAuth();
  const location = useLocation();

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setLoading(true);
    try { await signIn(email.trim(), password); setPassword(""); }
    catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setLoading(false); }
  }

  if (status === "authenticated") return <Navigate replace to={intendedDestination(location.state?.from)} />;
  if (status === "checking") return <main className="admin-wrap py-step-4"><InlineAlert>Checking administrator session…</InlineAlert></main>;

  return <div className="login-workspace">
    <SkipLink />
    <header className="border-b border-rule"><div className="admin-wrap flex flex-wrap items-center justify-between gap-x-4 py-2">
      <span className="py-2 font-serif text-h3">Gaurav Kumar Yadav</span><PortfolioLink />
    </div></header>
    <main id="main-content" tabIndex={-1} className="admin-wrap login-main">
      <div className="login-spread">
        <div className="login-masthead">
          <p className="workspace-kicker">Portfolio Admin</p>
          <h1 className="login-title">Control.</h1>
          <p className="mt-3 max-w-prose text-muted">Your portfolio, behind the scenes.</p>
        </div>
        <section className="login-panel" aria-labelledby="sign-in-heading">
          <h2 id="sign-in-heading" className={heading}>Sign in</h2>
          {(error || status === "unavailable") && <InlineAlert tone="error" className="mb-4" id="sign-in-error">{error || message}</InlineAlert>}
          <form onSubmit={handleSubmit} aria-busy={loading} aria-describedby={error || status === "unavailable" ? "sign-in-error" : undefined} className="mt-4 space-y-4">
            <Field label="Email address" id="admin-email" type="email" name="username" autoComplete="username" autoCapitalize="none"
              spellCheck={false} maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Field label="Password" id="admin-password" type={showPassword ? "text" : "password"} name="password" autoComplete="current-password"
              spellCheck={false} autoCapitalize="none" maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} required
              action={<Button variant="ghost" aria-controls="admin-password" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? "Hide password" : "Show password"}</Button>} />
            <Button type="submit" variant="primary" className="w-full" loading={loading}>
              {loading ? "Signing in…" : <>Access Admin Panel <Icon name="arrow" /></>}
            </Button>
          </form>
        </section>
      </div>
    </main>
    <footer className="border-t border-rule"><div className="admin-wrap py-step-2 font-mono text-xs text-muted">Private workspace</div></footer>
  </div>;
}
