import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const SESSION_KEY = "civic_pulse_session";
const OTP_KEY = "civic_pulse_otp";

const ADMIN_ACCOUNT = {
  id: "admin-001",
  firstName: "Municipal",
  lastName: "Admin",
  name: "Municipal Admin",
  email: "onethrajanu2003@gmail.com",
  nic: "000000000V",
  phone: "+94 11 222 3333",
  password: "janudi",
  role: "admin",
};

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

  const signupUser = () => {
    throw new Error("Citizen registration is disabled. Citizens report directly as guest users.");
  };

  const requestOtp = () => {
    throw new Error("OTP requests are disabled.");
  };

  const loginWithPassword = ({ email, password, role }) => {
    if (role === "admin") {
      if (
        (email || "").toLowerCase().trim() === ADMIN_ACCOUNT.email.toLowerCase() &&
        password === ADMIN_ACCOUNT.password
      ) {
        setSession(ADMIN_ACCOUNT);
        return ADMIN_ACCOUNT;
      }
      throw new Error("Invalid administrator credentials. Access Denied.");
    }
    throw new Error("Only administrators are permitted to sign in with credentials.");
  };

  const requestMobileOtp = (phone) => {
    const cleanPhone = String(phone).replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error("Please enter a valid mobile number (at least 8 digits).");
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const payload = { phone: cleanPhone, rawPhone: phone, otp, issuedAt: Date.now() };
    sessionStorage.setItem("civic_pulse_mobile_otp", JSON.stringify(payload));
    return payload;
  };

  const loginWithMobileOtp = (phone, enteredOtp) => {
    const rawOtp = sessionStorage.getItem("civic_pulse_mobile_otp");
    const cleanPhone = String(phone).replace(/\D/g, "");

    let otpValid = false;
    if (rawOtp) {
      try {
        const stored = JSON.parse(rawOtp);
        if (stored.otp === String(enteredOtp).trim() && (stored.phone === cleanPhone || stored.rawPhone === phone)) {
          otpValid = true;
        }
      } catch (_) {}
    }

    // Standard demo fallback codes
    if (String(enteredOtp).trim() === "123456" || String(enteredOtp).trim() === "000000") {
      otpValid = true;
    }

    if (!otpValid) {
      throw new Error("Invalid OTP code. Please check your simulated SMS or try the demo OTP: 123456.");
    }

    const lightUser = {
      id: `mobile-${cleanPhone}`,
      name: `Citizen (${phone})`,
      phone: phone,
      email: `${cleanPhone}@mobile.civicpulse.local`,
      role: "user",
      isLightAccount: true,
      authMethod: "mobile_otp"
    };

    setSession(lightUser);
    sessionStorage.removeItem("civic_pulse_mobile_otp");
    return lightUser;
  };

  const logout = () => {
    setSession(null);
    sessionStorage.removeItem(OTP_KEY);
    sessionStorage.removeItem("civic_pulse_mobile_otp");
  };

  const value = useMemo(
    () => ({ session, signupUser, requestOtp, loginWithPassword, requestMobileOtp, loginWithMobileOtp, logout }),
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
