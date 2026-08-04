import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const SESSION_KEY = "civic_pulse_session";
const ACCOUNTS_KEY = "civic_pulse_accounts";
const OTP_KEY = "civic_pulse_otp";

const ADMIN_ACCOUNT = {
  id: "admin-001",
  firstName: "Municipal",
  lastName: "Admin",
  name: "Municipal Admin",
  email: "admin@civicpulse.local",
  nic: "000000000V",
  phone: "+94 11 222 3333",
  password: "Admin@123",
  role: "admin",
};

const seedAccounts = () => {
  const existing = localStorage.getItem(ACCOUNTS_KEY);
  if (existing) return JSON.parse(existing);

  const seeded = [ADMIN_ACCOUNT];
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
  return seeded;
};

const getAccounts = () => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return seedAccounts();
    const parsed = JSON.parse(raw);
    return parsed.length ? parsed : seedAccounts();
  } catch {
    return [ADMIN_ACCOUNT];
  }
};

const persistAccounts = (accounts) => {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

const buildOtpPayload = (email) => {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const payload = { email: email.toLowerCase(), otp, issuedAt: Date.now() };
  sessionStorage.setItem(OTP_KEY, JSON.stringify(payload));
  return payload;
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

  const signupUser = ({ firstName, lastName, email, nic, phone, password, confirmPassword }) => {
    const accounts = getAccounts();
    const normalizedEmail = email.toLowerCase();
    const exists = accounts.some((user) => user.email.toLowerCase() === normalizedEmail);

    if (!firstName || !lastName || !email || !nic || !phone || !password || !confirmPassword) {
      throw new Error("Please complete all registration fields.");
    }

    if (password !== confirmPassword) {
      throw new Error("Password confirmation does not match.");
    }

    if (exists) {
      throw new Error("An account already exists for this email address.");
    }

    const user = {
      id: `user-${Date.now()}`,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email: normalizedEmail,
      nic,
      phone,
      password,
      role: "user",
    };

    const nextAccounts = [...accounts, user];
    persistAccounts(nextAccounts);
    setSession(user);
    return user;
  };

  const requestOtp = (email) => {
    const normalizedEmail = email.toLowerCase();
    const accounts = getAccounts();
    const roleMatches = accounts.some((account) => account.email.toLowerCase() === normalizedEmail);

    if (!roleMatches && normalizedEmail !== ADMIN_ACCOUNT.email) {
      throw new Error("This email is not registered. Please sign up first.");
    }

    return buildOtpPayload(normalizedEmail);
  };

  const loginWithPassword = ({ email, password, role }) => {
    const normalizedEmail = email.toLowerCase();
    const accounts = getAccounts();
    const foundUser = accounts.find((account) => account.email.toLowerCase() === normalizedEmail);

    if (!foundUser) {
      throw new Error("This email is not registered. Please create an account first.");
    }

    if (foundUser.password !== password) {
      throw new Error("The password you entered is incorrect.");
    }

    if (foundUser.role !== role) {
      throw new Error("This email does not match the selected portal role.");
    }

    setSession(foundUser);
    return foundUser;
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
