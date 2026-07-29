import { useNotifications } from "@/components/Notification";
import { supabase } from "@/logic/supabase";
import { useState } from "react";
import "./LoginView.css";

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotifications();

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

  return (
    <div className="login-view">
      <div className="login-view__card">
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
            <label htmlFor="password">Password</label>
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
      </div>
    </div>
  );
}
