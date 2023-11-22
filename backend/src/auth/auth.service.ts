import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entity/user.entity';
import { AuthUserDto, OAuthLoginDto } from './dto/auth.dto';
import { Request } from 'express';
import { cookieExtractor } from './strategy/jwtAuth.strategy';
import { REFRESH_ACCESS_TOKEN_URL } from './utils/auth.constant';
import { AuthRepository } from './auth.repository';
import { SocialType } from 'src/users/entity/socialType';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async login(oAuthLoginDto: OAuthLoginDto): Promise<any> {
    const { accessToken, refreshToken } = await this.getToken(oAuthLoginDto);
    const profile = await this.getUserProfile(accessToken);

    let user = await this.usersRepository.findBySocialIdAndSocialType(
      profile.id,
      oAuthLoginDto.socialType,
    );

    if (!user) {
      user = await this.signUp(profile, oAuthLoginDto.socialType);
    }
    this.authRepository.setRefreshToken(user.id, oAuthLoginDto.socialType, refreshToken);

    return {
      userId: user.id,
      token: this.jwtService.sign({
        id: user.id,
        nickname: user.nickname,
        accessToken,
      }),
    };
  }

  async signUp(user: AuthUserDto, socialType: SocialType): Promise<User> {
    return await this.usersRepository.createUser(user, socialType);
  }

  async refreshAccessToken(req: Request) {
    const userJwt = cookieExtractor(req);
    const payload = this.jwtService.decode(userJwt);
    const refreshTokenData = JSON.parse(await this.authRepository.getRefreshToken(payload.id));

    const newData = await fetch(REFRESH_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.makeNaverRefreshParams(refreshTokenData['refreshToken']),
    });

    const jsonData = await newData.json();

    return this.jwtService.sign({
      id: payload.id,
      nickname: payload.nickname,
      accessToken: jsonData['access_token'],
    });
  }

  private makeNaverRefreshParams(refreshToken: string): URLSearchParams {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', process.env.NAVER_CLIENT_ID);
    params.append('client_secret', process.env.NAVER_CLIENT_SECRET);
    params.append('refresh_token', refreshToken);

    return params;
  }

  async getToken(oAuthLoginDto: OAuthLoginDto) {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', process.env.NAVER_CLIENT_ID);
    params.append('client_secret', process.env.NAVER_CLIENT_SECRET);
    params.append('code', oAuthLoginDto.code);
    params.append('state', oAuthLoginDto.state);

    const response = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  async getUserProfile(accessToken: string) {
    const response = await fetch('https://openapi.naver.com/v1/nid/me', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    });

    const data = await response.json();
    return data.response as AuthUserDto;
  }
}
