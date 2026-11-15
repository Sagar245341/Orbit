import { AnimatePresence, motion } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { VerifyEmail } from "./pages/VerifyEmail";
import { ChatDashboard } from "./pages/ChatDashboard";
import { useAuth } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

function RouteTransition({ children }) {
  return (
    <motion.div
      className="route-frame"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loader" role="status" aria-label="Loading your account">
        <span className="brand-mark brand-mark-small"><span /></span>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <RouteTransition><Login /></RouteTransition>} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <RouteTransition><Register /></RouteTransition>} />
        <Route path="/verify-email" element={<RouteTransition><VerifyEmail /></RouteTransition>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RouteTransition><ChatDashboard /></RouteTransition>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  );
}
