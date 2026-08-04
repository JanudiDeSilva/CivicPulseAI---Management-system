import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Complaint from "./pages/Complaint";
import Success from "./pages/Success";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import UserPortal from "./pages/UserPortal";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Navbar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/complaint" element={<Complaint />} />
                <Route path="/success" element={<Success />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute role="admin">
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-portal"
                  element={
                    <ProtectedRoute role="user">
                      <UserPortal />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;