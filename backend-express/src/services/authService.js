import bcrypt from "bcryptjs";
import { User } from "../models/index.js";

const SALT_ROUNDS = 10;

export class AuthService {
  static async hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
  }

  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  static async registerUser(userData) {
    const { firstName, lastName, email, phone, nic, password, role = "user" } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [require("sequelize").Op.or]: [
          { email: email.toLowerCase() },
          { nic: nic.toUpperCase() },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        throw new Error("An account already exists for this email address.");
      }
      if (existingUser.nic.toUpperCase() === nic.toUpperCase()) {
        throw new Error("An account already exists for this NIC number.");
      }
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email: email.toLowerCase(),
      phone,
      nic: nic.toUpperCase(),
      password: hashedPassword,
      role,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  static async loginUser(email, nic, password, role) {
    let user;

    if (role === "admin") {
      // Admin login with email only
      user = await User.findOne({
        where: {
          email: email.toLowerCase(),
          role: "admin",
        },
      });
    } else {
      // User login with email or NIC
      user = await User.findOne({
        where: {
          [require("sequelize").Op.or]: [
            { email: email?.toLowerCase() },
            { nic: nic?.toUpperCase() },
          ],
          role: "user",
        },
      });
    }

    if (!user) {
      throw new Error("This account is not registered. Please create an account first.");
    }

    // Check password
    const isPasswordValid = await this.comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error("The password you entered is incorrect.");
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  static async getUserById(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found.");
    }
    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  static async requestOtp(email) {
    const user = await User.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!user) {
      throw new Error("This email is not registered. Please sign up first.");
    }

    // Generate OTP (in production, send via email/SMS)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    
    // For now, return OTP directly (in production, send via email service)
    return {
      email: user.email,
      otp,
      message: "OTP generated successfully",
    };
  }

  static async seedAdminUser() {
    const adminEmail = "onethrajanu2003@gmail.com";
    const adminPassword = "janudi";

    const existingAdmin = await User.findOne({
      where: {
        email: adminEmail,
        role: "admin",
      },
    });

    if (existingAdmin) {
      console.log("Admin user already exists");
      return existingAdmin;
    }

    const hashedPassword = await this.hashPassword(adminPassword);

    const admin = await User.create({
      firstName: "Municipal",
      lastName: "Admin",
      name: "Municipal Admin",
      email: adminEmail,
      nic: "000000000V",
      phone: "+94 11 222 3333",
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin user created successfully");
    const { password: _, ...adminWithoutPassword } = admin.toJSON();
    return adminWithoutPassword;
  }
}