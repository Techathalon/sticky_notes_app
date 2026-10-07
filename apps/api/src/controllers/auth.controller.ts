import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuthService } from '../services/auth.service';
import {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  RefreshTokenInput,
  LogoutInput,
  ChangePasswordInput,
} from '../validation/auth.schema';

export class AuthController {
  private readonly service = new AuthService();

  register = async (
    req: Request<object, object, RegisterInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.register(req.body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  login = async (
    req: Request<object, object, LoginInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.login(req.body);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (
    req: Request<object, object, ForgotPasswordInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.forgotPassword(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (
    req: Request<object, object, ResetPasswordInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.resetPassword(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (
    req: Request<object, object, RefreshTokenInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.refreshToken(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  logout = async (
    req: Request<object, object, LogoutInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.logout(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (
    req: AuthenticatedRequest & Request<object, object, ChangePasswordInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.changePassword(req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteAccount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const result = await this.service.deleteAccount(req.user.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
