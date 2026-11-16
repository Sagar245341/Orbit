import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Mail, MessageCircle, RotateCw, ShieldCheck, XCircle } from "lucide-react";
import { authService } from "../services/authService";
import { getApiError } from "../services/api";
import { AUTH_RETURN_KEY, getSafeReturnTo } from "../utils/authReturn";

export function VerifyEmail() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = getSafeReturnTo(
    location.state?.returnTo || params.get("returnTo") || localStorage.getItem(AUTH_RETURN_KEY)
  );
  const token = params.get("token");
  const [email, setEmail] = useState(location.state?.email || params.get("email") || "");
  const [status, setStatus] = useState(token ? "verifying" : location.state?.sendFailed ? "error" : "pending");
  const [message, setMessage] = useState(location.state?.error || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setStatus("verifying");
    authService.verifyEmail(token)
      .then((result) => {
        if (active) {
          setStatus("verified");
          setMessage(result.message);
        }
      })
      .catch((error) => {
        if (active) {
          setStatus("error");
          setMessage(getApiError(error));
        }
      });
    return () => { active = false; };
  }, [token]);

  const resend = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const result = await authService.resendVerification(email.trim());
      setMessage(result.message);
      setStatus("sent");
    } catch (error) {
      setMessage(getApiError(error));
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = status === "verified" ? CheckCircle2 : status === "error" ? XCircle : status === "verifying" ? RotateCw : Mail;
  const heading = {
    verifying: "Checking your link",
    verified: "You’re verified",
    error: "That link needs a refresh",
    pending: "Check your inbox",
    sent: "Check your inbox"
  }[status];

  return (
    <main className="auth-page verification-page">
      <div className="auth-glow auth-glow-left" />
      <div className="auth-glow auth-glow-right" />
      <motion.section className="verification-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Link to="/login" className="brand-lockup verification-brand" aria-label="Orbit sign in">
          <span className="brand-mark"><span /></span><span className="brand-name">orbit<span>.</span></span>
        </Link>
        <span className={`verification-icon verification-icon-${status}`}><Icon size={23} /></span>
        <h1>{heading}</h1>
        {status === "verifying" && <p>We’re checking that your verification link is valid.</p>}
        {status === "verified" && <p>{message || "Your email is verified. You can now sign in to Orbit."}</p>}
        {status === "pending" && (
          <>
            <p>Check your inbox for a verification link{email ? <> sent to <strong>{email}</strong></> : ""}. If you don’t see it, request another below.</p>
            <div className="verification-note"><ShieldCheck size={15} /> The link expires in 24 hours.</div>
          </>
        )}
        {status === "sent" && <p>{message}</p>}
        {status === "error" && <p className="verification-error-message">{message}</p>}

        {(status === "pending" || status === "error" || status === "sent") && (
          <form className="resend-form" onSubmit={resend}>
            <label className="field-label" htmlFor="verification-email">Email address</label>
            <div className="auth-input-wrap">
              <Mail size={17} />
              <input id="verification-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <button type="submit" className="button-primary auth-submit" disabled={submitting || !email.trim()}>
              {submitting ? <><span className="button-spinner" /> Sending…</> : "Send a new verification email"}
            </button>
          </form>
        )}

        {status === "verified" && <Link className="button-primary verification-continue" to={returnTo === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(returnTo)}`}>Continue to sign in <span>→</span></Link>}
        <p className="verification-footer"><MessageCircle size={14} /> Need to use another address? <Link to={returnTo === "/" ? "/register" : `/register?returnTo=${encodeURIComponent(returnTo)}`}>Create a new account</Link></p>
      </motion.section>
    </main>
  );
}
