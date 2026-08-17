import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/api";

const AuthContext = createContext(null);

const SESSION_KEY = "civic_pulse_session";
const OTP_KEY = "civic_pulse_otp";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session]);

  const signupUser = async ({ firstName, lastName, email, nic, phone, password, confirmPassword }) => {
    if (!firstName || !lastName || !email || !nic || !phone || !password || !confirmPassword) {
      throw new Error("Please complete all registration fields.");
    }

    if (password !== confirmPassword) {
      throw new Error("Password confirmation does not match.");
    }

    const response = await authService.register({
      firstName,
      lastName,
      email,
      nic,
      phone,
      password,
      confirmPassword,
    });

    if (response.success) {
      setSession(response.user);
      return response.user;
    } else {
      throw new Error(response.error || "Registration failed");
    }
  };

  const requestOtp = async (email) => {
    const response = await authService.requestOtp(email);
    
    if (response.success) {
      // Store OTP in session storage for verification
      const payload = { 
        email: email.toLowerCase(), 
        otp: response.otp, 
        issuedAt: Date.now() 
      };
      sessionStorage.setItem(OTP_KEY, JSON.stringify(payload));
      return payload;
    } else {
      throw new Error(response.error || "OTP request failed");
    }
  };

  const loginWithPassword = async ({ email, nic, password, role }) => {
    if (!password) {
      throw new Error("Password is required");
    }

    const response = await authService.login({
      email,
      nic,
      password,
      role,
    });

    if (response.success) {
      setSession(response.user);
      return response.user;
    } else {
      throw new Error(response.error || "Login failed");
    }
  };

  const logout = () => {
    setSession(null);
    sessionStorage.removeItem(OTP_KEY);
  };

  const value = useMemo(
    () => ({ session, signupUser, requestOtp, loginWithPassword, logout }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
