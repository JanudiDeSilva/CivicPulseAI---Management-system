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
  email: "onethrajanu2003@gmail.com",
  nic: "000000000V",
  phone: "+94 11 222 3333",
  password: "janudi",
  role: "admin",
};

const seedAccounts = () => {
  const seeded = [ADMIN_ACCOUNT];
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
  return seeded;
};

const getAccounts = () => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return seedAccounts();

    const parsed = JSON.parse(raw);
    const existingUsers = Array.isArray(parsed)
      ? parsed.filter((account) => account.role !== "admin")
      : [];

    const authoritative = [ADMIN_ACCOUNT, ...existingUsers];
    persistAccounts(authoritative);
    return authoritative;
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
    const exists = accounts.some((user) => user.email && user.email.toLowerCase() === normalizedEmail);

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
    const sanitizedAccounts = [ADMIN_ACCOUNT, ...nextAccounts.filter((account) => account.role !== "admin")];
    persistAccounts(sanitizedAccounts);
    setSession(user);
    return user;
  };

  const requestOtp = (email) => {
    const normalizedEmail = email.toLowerCase();
    const accounts = getAccounts();
    const roleMatches = accounts.some((account) => account.email && account.email.toLowerCase() === normalizedEmail);

    if (!roleMatches && normalizedEmail !== ADMIN_ACCOUNT.email) {
      throw new Error("This email is not registered. Please sign up first.");
    }

    return buildOtpPayload(normalizedEmail);
  };

  const loginWithPassword = ({ email, nic, password, role }) => {
    const accounts = getAccounts();
    let foundUser = null;

    if (role === "admin") {
      foundUser = accounts.find((account) => account.role === "admin");
      if (!foundUser) {
        throw new Error("Admin account is not available.");
      }

      if (foundUser.email.toLowerCase() !== (email || "").toLowerCase()) {
        throw new Error("Admin email is incorrect.");
      }
    } else {
      foundUser = accounts.find((account) => {
        const matchesNic = account.nic && account.nic.toLowerCase() === (nic || "").toLowerCase();
        const matchesEmail = account.email && account.email.toLowerCase() === (email || "").toLowerCase();
        return matchesNic || matchesEmail;
      });
    }

    if (!foundUser) {
      throw new Error("This account is not registered. Please create an account first.");
    }

    if (foundUser.password !== password) {
      throw new Error("The password you entered is incorrect.");
    }

    if (foundUser.role !== role) {
      throw new Error("This account does not match the selected portal role.");
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
