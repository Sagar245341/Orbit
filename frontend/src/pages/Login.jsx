import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, LockKeyhole, Mail, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../services/api";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNeedsVerification(false);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
      setNeedsVerification(requestError?.response?.status === 403);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-left" />
      <div className="auth-glow auth-glow-right" />
      <div className="auth-layout">
        <motion.section className="auth-story" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
          <Link to="/login" className="brand-lockup auth-brand" aria-label="Orbit home">
            <span className="brand-mark"><span /></span><span className="brand-name">orbit<span>.</span></span>
          </Link>
          <div className="story-copy">
            <span className="story-kicker"><Sparkles size={14} /> A little more in sync</span>
            <h1>Good work<br />starts with<br /><span>a conversation.</span></h1>
            <p>A calm place for your team to share ideas, get aligned, and make things happen together.</p>
          </div>
          <div className="story-footer"><span className="story-proof"><ShieldCheck size={15} /></span><span>Made for teams that care about the details.</span></div>
          <span className="auth-decoration auth-decoration-one" /><span className="auth-decoration auth-decoration-two" />
        </motion.section>

        <motion.section className="auth-card-wrap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
          <div className="auth-card">
            <div className="auth-card-heading">
              <div className="auth-card-mobile-brand"><span className="brand-mark"><span /></span><span className="brand-name">orbit<span>.</span></span></div>
              <span className="auth-icon"><MessageCircle size={20} /></span>
              <h2>Welcome back</h2>
              <p>Sign in to pick up the conversation.</p>
            </div>
            <form onSubmit={submit} className="auth-form">
              <label className="field-label" htmlFor="login-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={17} />
                <input id="login-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>

              <div className="password-label-row">
                <label className="field-label" htmlFor="login-password">Password</label>
                <span className="password-secure"><LockKeyhole size={12} /> Secure sign in</span>
              </div>
              <div className="auth-input-wrap">
                <LockKeyhole size={17} />
                <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <label className="remember-row">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span className="custom-checkbox" />
                <span>Remember me <small>(this device)</small></span>
              </label>

              {error && <div className="form-error" role="alert">{error}</div>}
              {needsVerification && <Link className="verification-resend-link" to={`/verify-email?email=${encodeURIComponent(email.trim())}`}>Send another verification email</Link>}
              <button className="button-primary auth-submit" type="submit" disabled={submitting}>
                {submitting ? <><span className="button-spinner" /> Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}
              </button>
            </form>
            <div className="auth-trust"><ShieldCheck size={15} /> Your conversations stay yours.</div>
            <p className="auth-switch">New to Orbit? <Link to="/register">Create an account <span>→</span></Link></p>
          </div>
          <div className="auth-card-footnote">By continuing, you agree to keep the conversation respectful.</div>
        </motion.section>
      </div>
    </main>
  );
}
