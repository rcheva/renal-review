import { useNotifications } from "@/components/Notification";
import { supabase } from "@/logic/supabase";
import { useEffect, useState } from "react";
import "./LoginView.css";

interface LoginViewProps {
  initialMode?: "login" | "forgot" | "reset";
  onPasswordResetSuccess?: () => void;
}

export default function LoginView({
  initialMode = "login",
  onPasswordResetSuccess,
}: LoginViewProps) {
  const [mode, setMode] = useState<"login" | "forgot" | "reset">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotifications();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showNotification({
          title: "Login Failed",
          message:
            error.message === "fetch failed"
              ? "Could not connect to Supabase server. Please check your VITE_SUPABASE_URL in .env.local and verify your Supabase project status."
              : error.message,
          type: "error",
        });
      }
    } catch (err: any) {
      showNotification({
        title: "Login Error",
        message:
          err?.message || "Failed to connect to the authentication server.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        showNotification({
          title: "Registration Failed",
          message:
            error.message === "fetch failed"
              ? "Could not connect to Supabase server. Please check your VITE_SUPABASE_URL in .env.local and verify your Supabase project status."
              : error.message,
          type: "error",
        });
      } else {
        showNotification({
          title: "Success",
          message: "Registration successful! You can now log in.",
          type: "success",
        });
      }
    } catch (err: any) {
      showNotification({
        title: "Registration Error",
        message:
          err?.message || "Failed to connect to the authentication server.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showNotification({
        title: "Email Required",
        message: "Please enter your email address.",
        type: "error",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) {
        showNotification({
          title: "Reset Request Failed",
          message: error.message,
          type: "error",
        });
      } else {
        showNotification({
          title: "Check Your Email",
          message:
            "A password reset link has been sent to your email address.",
          type: "success",
        });
        setMode("login");
      }
    } catch (err: any) {
      showNotification({
        title: "Reset Request Error",
        message: err?.message || "Failed to request password reset.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      showNotification({
        title: "Password Required",
        message: "Please enter a new password.",
        type: "error",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification({
        title: "Password Mismatch",
        message: "New password and confirmation password do not match.",
        type: "error",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        showNotification({
          title: "Password Update Failed",
          message: error.message,
          type: "error",
        });
      } else {
        showNotification({
          title: "Password Updated",
          message: "Your password has been successfully updated!",
          type: "success",
        });
        if (onPasswordResetSuccess) {
          onPasswordResetSuccess();
        } else {
          setMode("login");
        }
      }
    } catch (err: any) {
      showNotification({
        title: "Update Error",
        message: err?.message || "Failed to update password.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-view">
      <div className="login-view__card">
        {mode === "reset" ? (
          <>
            <h1>Reset Your Password</h1>
            <p>Enter your new password below</p>
            <form onSubmit={handleUpdatePassword} className="login-view__form">
              <div className="login-view__input-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="login-view__input-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="login-view__actions">
                <button
                  type="submit"
                  className="login-view__button login-view__button--primary"
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </>
        ) : mode === "forgot" ? (
          <>
            <h1>Forgot Password</h1>
            <p>Enter your email to receive a password reset link</p>
            <form
              onSubmit={handleResetPasswordRequest}
              className="login-view__form"
            >
              <div className="login-view__input-group">
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="login-view__actions">
                <button
                  type="submit"
                  className="login-view__button login-view__button--primary"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
                <button
                  type="button"
                  className="login-view__button login-view__button--secondary"
                  onClick={() => setMode("login")}
                  disabled={loading}
                >
                  Back to Login
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1>Welcome Back</h1>
            <p>Sign in to sync your flashcards</p>

            <form onSubmit={handleLogin} className="login-view__form">
              <div className="login-view__input-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="login-view__input-group">
                <div className="login-view__label-row">
                  <label htmlFor="password">Password</label>
                  <button
                    type="button"
                    className="login-view__forgot-btn"
                    onClick={() => setMode("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="login-view__actions">
                <button
                  type="submit"
                  className="login-view__button login-view__button--primary"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Login"}
                </button>
                <button
                  type="button"
                  className="login-view__button login-view__button--secondary"
                  onClick={handleRegister}
                  disabled={loading}
                >
                  Create Account
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

