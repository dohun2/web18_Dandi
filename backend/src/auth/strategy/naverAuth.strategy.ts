import { Profile, Strategy } from 'passport-naver-v2';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { SocialType } from '../../users/entity/socialType';
import 'dotenv/config';
import { VerifyCallback } from '../utils/verifyCallback';
import { AuthUserDto } from '../dto/auth.dto';

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor() {
    super({
      clientID: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
      callbackURL: process.env.NAVER_CALLBACK_URL,
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { id, email, nickname, profileImage } = profile;
    const user: AuthUserDto = {
      id,
      email,
      nickname,
      profileImage,
      accessToken,
      refreshToken,
      socialType: SocialType.NAVER,
    };

    return done(null, user);
  }
}