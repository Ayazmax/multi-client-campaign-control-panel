import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const DEMO_ACCOUNTS = [
  ["amina@trident.demo", "Owner of both workspaces"],
  ["ravi@trident.demo", "Editor for Northwind, Lanka Homes, and Island Eats"],
  ["meera@trident.demo", "Reviewer for those same three clients"],
];

export function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("amina@trident.demo");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
      const next = params.get("next") || "/app";
      navigate(next.startsWith("/") && !next.startsWith("//") ? next : "/app", {
        replace: true,
      });
    } catch (caught) {
      setError(caught.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <p className="eyebrow">Control panel</p>
        <h1>Sign in</h1>
        <p className="lede">
          Use a demo account. The session stays in an httpOnly cookie.
        </p>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <ul className="demo-accounts">
          {DEMO_ACCOUNTS.map(([address, note]) => (
            <li key={address}>
              <button
                type="button"
                className="account-pick"
                onClick={() => setEmail(address)}
              >
                {address}
              </button>
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <p className="password-note">Shared password: Demo1234!</p>
      </form>
    </main>
  );
}
