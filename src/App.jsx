import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "./Components/shared/LanguageContext";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./Layout.jsx";

import Home from "./Pages/Home.jsx";
import Seminars from "./Pages/Seminars.jsx";
import SeminarDetails from "./Pages/SeminarDetails.jsx";
import Login from "./Pages/Login.jsx";
import Privacy from "./Pages/Privacy.jsx";
import Terms from "./Pages/Terms.jsx";
import Profile from "./Pages/Profile.jsx";
import CreateSeminar from "./Pages/CreateSeminar.jsx";
import MySeminars from "./Pages/MySeminars.jsx";
import Wallet from "./Pages/Wallet.jsx";
import ProcessPayment from "./Pages/ProcessPayment.jsx";
import Teachers from "./Pages/Teachers.jsx";
import TeacherProfile from "./Pages/TeacherProfile.jsx";

// ✅ BackOffice
import AdminLayout from "./Pages/Admin/AdminLayout.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Cargando...
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search || ""}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}

function App() {
  const basePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "") || "/";
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <Router basename={basePath}>
            <Toaster position="top-center" richColors />

            <Routes>
              <Route path="/login" element={<Login />} />

              {/* APP PÚBLICA con Layout */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="seminars" element={<Seminars />} />
                <Route path="seminars/:id" element={<SeminarDetails />} />
                <Route path="seminardetails" element={<SeminarDetails />} />
                <Route path="teachers" element={<Teachers />} />
                <Route path="teachers/:id" element={<TeacherProfile />} />
                <Route path="privacy" element={<Privacy />} />
                <Route path="terms" element={<Terms />} />
                <Route
                  path="profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route
                  path="createseminar"
                  element={
                    <RequireAuth>
                      <CreateSeminar />
                    </RequireAuth>
                  }
                />
                <Route
                  path="my-seminars"
                  element={
                    <RequireAuth>
                      <MySeminars />
                    </RequireAuth>
                  }
                />
                <Route
                  path="wallet"
                  element={
                    <RequireAuth>
                      <Wallet />
                    </RequireAuth>
                  }
                />
                <Route
                  path="process-payment"
                  element={
                    <RequireAuth>
                      <ProcessPayment />
                    </RequireAuth>
                  }
                />
              </Route>

              {/* BACKOFFICE sin Layout público */}
              <Route path="/admin/*" element={<AdminLayout />} />
            </Routes>
          </Router>
        </LanguageProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
