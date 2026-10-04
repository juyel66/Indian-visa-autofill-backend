import { Router } from 'express';
import {
  login,
  googleExchange,
  googleAuth,
  refreshToken,
  getMe,
  logout,
  changeOwnPassword,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Dashboard email/password authentication
router.post('/login', login);

// OAuth 2.0 Web Application Authorization Code exchange
router.post('/google/exchange', googleExchange);

// Direct credential/token verification (backward compatibility for Chrome Extension)
router.post('/google', googleAuth);

// Token refresh & revocation
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Authenticated user profile & password
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, changeOwnPassword);

export default router;

