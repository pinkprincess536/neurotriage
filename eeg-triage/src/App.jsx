import { useState, useCallback } from "react";
import Login from "./components/Login";
import DoctorDashboard from "./components/DoctorDashboard";
import AdminPanel from "./components/AdminPanel";
import { BACKEND_URL } from "./config";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("doctor_token"));
  const [role, setRole] = useState(() => localStorage.getItem("doctor_role"));

  const [models, setModels] = useState(null);
  const [activating, setActivating] = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState(null);
  const [retrainError, setRetrainError] = useState(null);

  const fetchModels = useCallback(async (authToken) => {
    try {
      const res = await fetch(`${BACKEND_URL}/models`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setModels(await res.json());
    } catch {}
  }, []);

  const handleLogin = (userToken, userRole) => {
    localStorage.setItem("doctor_token", userToken);
    localStorage.setItem("doctor_role", userRole);
    setToken(userToken);
    setRole(userRole);
    if (userRole === "admin") fetchModels(userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("doctor_token");
    localStorage.removeItem("doctor_role");
    setToken(null);
    setRole(null);
    setModels(null);
    setRetrainResult(null);
    setRetrainError(null);
  };

  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainResult(null);
    setRetrainError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/retrain`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Retraining failed");
      }
      const data = await res.json();
      setRetrainResult(data);
      fetchModels(token);
    } catch (err) {
      setRetrainError(err.message);
    } finally {
      setRetraining(false);
    }
  };

  const handleActivate = async (version) => {
    setActivating(version);
    try {
      const res = await fetch(`${BACKEND_URL}/models/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Activation failed");
      }
      fetchModels(token);
    } catch (err) {
      alert(err.message);
    } finally {
      setActivating(null);
    }
  };

  if (!token) return <Login onLogin={handleLogin} />;

  if (role === "admin") {
    return (
      <AdminPanel
        token={token}
        models={models}
        onRetrain={handleRetrain}
        onActivate={handleActivate}
        retraining={retraining}
        retrainResult={retrainResult}
        retrainError={retrainError}
        activating={activating}
        onLogout={handleLogout}
      />
    );
  }

  return <DoctorDashboard token={token} onLogout={handleLogout} />;
}
