import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, LockKeyhole, Mail, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../services/api";
import { AUTH_RETURN_KEY, getSafeReturnTo } from "../utils/authReturn";

export function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Those passwords don’t match. Please check and try again.");
      return;
    }
    setSubmitting(true);
    try {
      await register({ username: username.trim(), email: email.trim(), password });
      if (returnTo !== "/") localStorage.setItem(AUTH_RETURN_KEY, returnTo);
      const returnQuery = returnTo === "/" ? "" : `&returnTo=${encodeURIComponent(returnTo)}`;
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}${returnQuery}`, {
        replace: true,
        state: { email: email.trim(), returnTo },
      });
    } catch (requestError) {
      if (requestError?.response?.status === 503) {
        if (returnTo !== "/") localStorage.setItem(AUTH_RETURN_KEY, returnTo);
        navigate(`/verify-email?email=${encodeURIComponent(email.trim())}${returnTo === "/" ? "" : `&returnTo=${encodeURIComponent(returnTo)}`}`, {
          replace: true,
          state: { email: email.trim(), returnTo, sendFailed: true, error: getApiError(requestError) }
        });
        return;
      }
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-left" /><div className="auth-glow auth-glow-right" />
      <div className="auth-layout">
        <motion.section className="auth-story" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
          <Link to="/login" className="brand-lockup auth-brand" aria-label="Orbit home"><span className="brand-mark"><span /></span><span className="brand-name">orbit<span>.</span></span></Link>
          <div className="story-copy">
            <span className="story-kicker"><MessageCircle size={14} /> Your team, in orbit</span>
            <h1>Better together<br />is just a<br /><span>hello away.</span></h1>
            <p>Bring your people into one thoughtful space. No noise, just the conversations that move you forward.</p>
          </div>
          <div className="story-footer"><span className="story-proof"><ShieldCheck size={15} /></span><span>A more intentional way to work together.</span></div>
          <span className="auth-decoration auth-decoration-one" /><span className="auth-decoration auth-decoration-two" />
        </motion.section>

        <motion.section className="auth-card-wrap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
          <div className="auth-card register-card">
            <div className="auth-card-heading">
              <div className="auth-card-mobile-brand"><span className="brand-mark"><span /></span><span className="brand-name">orbit<span>.</span></span></div>
              <span className="auth-icon"><MessageCircle size={20} /></span>
              <h2>Create your account</h2>
              <p>Start a new chapter with your team.</p>
            </div>
            <form onSubmit={submit} className="auth-form">
              <label className="field-label" htmlFor="register-username">Username</label>
              <div className="auth-input-wrap">
                <UserRound size={17} />
                <input id="register-username" autoComplete="username" placeholder="e.g. alex_morgan" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={40} pattern="[a-zA-Z0-9_]+" title="Use 3–40 letters, numbers, or underscores." required />
              </div>
              <label className="field-label" htmlFor="register-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={17} />
                <input id="register-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <label className="field-label" htmlFor="register-password">Password</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={17} />
                <input id="register-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <label className="field-label" htmlFor="register-confirm">Confirm password</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={17} />
                <input id="register-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Enter your password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </div>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="button-primary auth-submit" type="submit" disabled={submitting}>
                {submitting ? <><span className="button-spinner" /> Creating account…</> : <>Create account <span aria-hidden="true">→</span></>}
              </button>
            </form>
            <p className="auth-switch">Already have an account? <Link to={returnTo === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in <span>→</span></Link></p>
          </div>
          <div className="auth-card-footnote">By continuing, you agree to keep the conversation respectful.</div>
        </motion.section>
      </div>
    </main>
  );
}
