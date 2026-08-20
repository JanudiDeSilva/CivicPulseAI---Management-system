import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import About from "./pages/AboutUs";
import Complaint from "./pages/Complaint";
import Success from "./pages/Success";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import UserPortal from "./pages/UserPortal";
import NotFound from "./pages/NotFound";

import GarbageClassifier from "./components/GarbageClassifier";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Navbar />

            <main className="main-content">
              <Routes>

                {/* Public Home */}
                <Route
                  path="/"
                  element={<Home />}
                />

                {/* Public About */}
                <Route
                  path="/about"
                  element={<About />}
                />

                {/* Admin Login */}
                <Route
                  path="/login"
                  element={<AuthPage />}
                />

                {/* Citizen Complaint */}
                <Route
                  path="/complaint"
                  element={<Complaint />}
                />

                {/* Complaint Submission Success */}
                <Route
                  path="/success"
                  element={<Success />}
                />

                {/* Citizen Tracking Portal */}
                <Route
                  path="/my-portal"
                  element={<UserPortal />}
                />

                {/* Admin Dashboard */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute role="admin">
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Garbage Classifier Test */}
                <Route
                  path="/garbage-test"
                  element={<GarbageClassifier />}
                />

                {/* 404 */}
                <Route
                  path="*"
                  element={<NotFound />}
                />

              </Routes>
            </main>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;