import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DiariesRepository } from './diaries.repository';
import {
  CreateDiaryDto,
  GetAllEmotionsRequestDto,
  GetAllEmotionsResponseDto,
  ReadUserDiariesRequestDto,
  UpdateDiaryDto,
} from './dto/diary.dto';
import { User } from 'src/users/entity/user.entity';
import { TagsService } from 'src/tags/tags.service';
import { DiaryStatus } from './entity/diaryStatus';
import { Diary } from './entity/diary.entity';
import { plainToClass } from 'class-transformer';
import { CLOVA_SENTIMENT_URL, MoodDegree, MoodType } from './utils/diaries.constant';
import { TimeUnit } from './dto/timeUnit.enum';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class DiariesService {
  constructor(
    private readonly diariesRepository: DiariesRepository,
    private readonly usersService: UsersService,
    private readonly tagsService: TagsService,
  ) {}

  async saveDiary(user: User, createDiaryDto: CreateDiaryDto) {
    const tags = await this.tagsService.mapTagNameToTagType(createDiaryDto.tagNames);
    const diary = plainToClass(Diary, createDiaryDto, {
      excludePrefixes: ['tag'],
    });

    diary.author = user;
    diary.tags = tags;
    diary.summary = await this.getSummary(diary.title, diary.content);
    diary.mood = await this.judgeOverallMood(diary.content);

    await this.diariesRepository.save(diary);
  }

  async findDiary(user: User, id: number, readMode: boolean) {
    const diary = await this.diariesRepository.findById(id);
    this.existsDiary(diary);

    const author = await diary.author;
    this.checkAuthorization(author, user, diary.status, readMode);

    return diary;
  }

  async updateDiary(id: number, user: User, updateDiaryDto: UpdateDiaryDto) {
    const existingDiary = await this.findDiary(user, id, false);

    existingDiary.tags = await this.tagsService.mapTagNameToTagType(updateDiaryDto.tagNames);
    Object.keys(updateDiaryDto).forEach((key) => {
      if (updateDiaryDto[key]) {
        existingDiary[key] = updateDiaryDto[key];
      }
    });

    if (updateDiaryDto.content) {
      existingDiary.summary = await this.getSummary(existingDiary.title, updateDiaryDto.content);
      existingDiary.mood = await this.judgeOverallMood(updateDiaryDto.content);
    }

    return await this.diariesRepository.save(existingDiary);
  }

  async deleteDiary(user: User, id: number) {
    await this.findDiary(user, id, false);

    await this.diariesRepository.softDelete(id);
  }

  async findAllDiaryEmotions(
    user: User,
    userId: number,
    getAllEmotionsDto: GetAllEmotionsRequestDto,
  ) {
    let { startDate, lastDate } = getAllEmotionsDto;
    if (!getAllEmotionsDto.startDate || !getAllEmotionsDto.lastDate) {
      const currentDate = new Date();

      startDate = currentDate.toLocaleString();
      lastDate = currentDate.setMonth(currentDate.getMonth() + 1).toLocaleString();
    }

    const diaries = await this.diariesRepository.findAllDiaryBetweenDates(
      userId,
      user.id === userId,
      startDate,
      lastDate,
    );
    return this.groupDiariesByEmotion(diaries);
  }

  private groupDiariesByEmotion(diaries: Diary[]) {
    return diaries.reduce<GetAllEmotionsResponseDto[]>((acc, crr) => {
      const diaryInfo = {
        id: crr.id,
        title: crr.title,
        createdAt: crr.createdAt,
      };

      const existingEmotion = acc.find((e) => e.emotion === crr.emotion);
      if (existingEmotion) {
        existingEmotion.diaryInfos.push(diaryInfo);
      } else {
        acc.push({
          emotion: crr.emotion,
          diaryInfos: [diaryInfo],
        });
      }
      return acc;
    }, []);
  }

  async findDiaryByAuthorId(user: User, id: number, requestDto: ReadUserDiariesRequestDto) {
    const author = await this.usersService.findUserById(id);

    let diaries: Diary[];
    if (requestDto.type === TimeUnit.Day) {
      diaries = await this.diariesRepository.findDiariesByAuthorIdWithPagination(
        id,
        user.id === id,
        requestDto.lastIndex,
      );
    } else {
      diaries = await this.diariesRepository.findDiariesByAuthorIdWithDates(
        id,
        user.id === id,
        requestDto.startDate,
        requestDto.endDate,
      );
    }

    return { author, diaries };
  }

  private existsDiary(diary: Diary) {
    if (!diary) {
      throw new BadRequestException('존재하지 않는 일기입니다.');
    }
  }

  private checkAuthorization(author: User, user: User, status: DiaryStatus, readMode: boolean) {
    if ((!readMode || status === DiaryStatus.PRIVATE) && author.id !== user.id) {
      throw new ForbiddenException('권한이 없는 사용자입니다.');
    }
  }

  private async getSummary(title: string, content: string) {
    content = content.substring(0, 2000);

    const response = await fetch(
      'https://naveropenapi.apigw.ntruss.com/text-summary/v1/summarize',
      {
        method: 'POST',
        headers: {
          'X-NCP-APIGW-API-KEY-ID': process.env.NCP_CLOVA_SUMMARY_API_KEY_ID,
          'X-NCP-APIGW-API-KEY': process.env.NCP_CLOVA_SUMMARY_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document: { title, content },
          option: { language: 'ko' },
        }),
      },
    );

    const body = await response.json();
    return body.summary;
  }

  private async judgeOverallMood(fullContent: string) {
    const [statistics, totalNumber] = await this.sumMoodAnalysis(fullContent);

    const [type, sum] = Object.entries(statistics).reduce((max, cur) => {
      return cur[1] > max[1] ? cur : max;
    });

    const figure = sum / totalNumber;

    switch (type) {
      case MoodType.POSITIVE:
        if (figure > 50) {
          return MoodDegree.SO_GOOD;
        }
        return MoodDegree.GOOD;
      case MoodType.NEGATIVE:
        if (figure > 50) {
          return MoodDegree.SO_BAD;
        }
        return MoodDegree.BAD;
      default:
        return MoodDegree.SO_SO;
    }
  }

  private async sumMoodAnalysis(fullContent: string): Promise<[Record<string, number>, number]> {
    const plainContent = fullContent.replace(/<img[^>]*>/g, '');
    const numberOfChunk = Math.floor(plainContent.length / 1000) + 1;

    const moodStatistics = {
      [MoodType.POSITIVE]: 0,
      [MoodType.NEGATIVE]: 0,
      [MoodType.NEUTRAL]: 0,
    };

    for (let i = 0; i < numberOfChunk; i++) {
      const start = i * 1000;
      const end = i < numberOfChunk - 1 ? start + 1000 : start + (plainContent.length % 1000);

      if (start === end) {
        break;
      }

      const analysis = await this.analyzeMood(plainContent.slice(start, end));

      Object.keys(analysis).forEach((key) => {
        moodStatistics[key] += analysis[key];
      });
    }

    return [moodStatistics, numberOfChunk];
  }

  private async analyzeMood(content: string): Promise<Record<string, number>> {
    const response = await fetch(CLOVA_SENTIMENT_URL, {
      method: 'POST',
      headers: {
        'X-NCP-APIGW-API-KEY-ID': process.env.NCP_CLOVA_SENTIMENT_API_KEY_ID,
        'X-NCP-APIGW-API-KEY': process.env.NCP_CLOVA_SENTIMENT_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    const jsonResponse = await response.json();

    return jsonResponse.document.confidence;
  }
}
