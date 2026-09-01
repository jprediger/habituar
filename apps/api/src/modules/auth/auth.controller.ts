import { Body, Controller, Inject, Post, Req, Res, UnprocessableEntityException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginSchema, RegisterSchema } from './auth.schema';
import { Public } from './public.decorator';

const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) throw new UnprocessableEntityException(parsed.error.flatten());
    return this.authService.register(parsed.data);
  }

  @Public()
  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) throw new UnprocessableEntityException(parsed.error.flatten());

    const { token, user } = await this.authService.login(parsed.data);
    res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: SESSION_COOKIE_MAX_AGE_MS });
    return { user: { id: user.id, email: user.email, name: user.name } };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.session ?? req.headers.authorization?.replace('Bearer ', '');
    if (token) await this.authService.logout(token);
    res.clearCookie('session');
    return { ok: true };
  }
}