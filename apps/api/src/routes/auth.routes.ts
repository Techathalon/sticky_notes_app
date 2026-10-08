import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  changePasswordSchema,
} from '../validation/auth.schema';

export const authRouter: Router = Router();
const ctrl = new AuthController();

// POST /api/auth/register
authRouter.post('/register', validate(registerSchema), ctrl.register);

// POST /api/auth/login
authRouter.post('/login', validate(loginSchema), ctrl.login);

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', validate(forgotPasswordSchema), ctrl.forgotPassword);

// POST /api/auth/reset-password
authRouter.post('/reset-password', validate(resetPasswordSchema), ctrl.resetPassword);

// POST /api/auth/refresh-token
authRouter.post('/refresh-token', validate(refreshTokenSchema), ctrl.refreshToken);

// POST /api/auth/logout
authRouter.post('/logout', validate(logoutSchema), ctrl.logout);

// POST /api/auth/change-password  (requires valid access token)
authRouter.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  ctrl.changePassword,
);

// DELETE /api/auth/account  (requires valid access token)
authRouter.delete('/account', authenticate, ctrl.deleteAccount);
