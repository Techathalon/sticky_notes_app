import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthResponse, User } from '@repo/types';
import { prisma } from '../config/database';
import { env } from '../config';
import { AppError } from '../middleware/errorHandler';
import {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  RefreshTokenInput,
  LogoutInput,
  ChangePasswordInput,
} from '../validation/auth.schema';
import { sendResetEmail } from './email.service';

export class AuthService {
  private async createRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const record = await prisma.refreshToken.create({
      data: { userId, token },
    });
    return record.id;
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new AppError(409, 'An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        name: input.name ?? null,
      },
    });

    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const tokenId = await this.createRefreshToken(user.id);

    return {
      tokenId,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      throw new AppError(401, 'Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(input.password, user.password);
    if (!passwordMatch) {
      throw new AppError(401, 'Invalid email or password');
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const tokenId = await this.createRefreshToken(user.id);

    return {
      tokenId,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  async refreshToken(input: RefreshTokenInput): Promise<{ accessToken: string; user: User }> {
    const record = await prisma.refreshToken.findUnique({
      where: { id: input.tokenId },
      include: { user: true },
    });

    if (!record) {
      throw new AppError(401, 'Session expired, please log in again');
    }

    const accessToken = jwt.sign(
      { id: record.user.id, email: record.user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    return {
      accessToken,
      user: {
        id: record.user.id,
        email: record.user.email,
        name: record.user.name,
        createdAt: record.user.createdAt.toISOString(),
        updatedAt: record.user.updatedAt.toISOString(),
      },
    };
  }

  async logout(input: LogoutInput): Promise<{ message: string }> {
    await prisma.refreshToken.deleteMany({ where: { id: input.tokenId } });
    return { message: 'Logged out' };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new AppError(404, 'No account found with this email address');
    }

    // Delete any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Generate secure random token with 24-hour expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetLink = `${env.APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendResetEmail(user.email, user.name ?? '', resetLink);

    return { message: 'Password reset link sent to your email address.' };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new AppError(400, 'Invalid or expired reset link');
    }

    const record = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        token: input.token,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new AppError(400, 'Invalid or expired reset link');
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    return { message: 'Password updated successfully' };
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'User not found');

    const valid = await bcrypt.compare(input.currentPassword, user.password);
    if (!valid) throw new AppError(400, 'Current password is incorrect');

    const hashed = await bcrypt.hash(input.newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    return { message: 'Password changed successfully' };
  }
}
