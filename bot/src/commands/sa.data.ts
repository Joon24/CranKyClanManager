import { SlashCommandBuilder } from 'discord.js';

export const saCommandData = new SlashCommandBuilder()
  .setName('sa')
  .setDescription('서든어택 전적 조회')
  .addSubcommand((sub) => sub.setName('help').setDescription('봇 사용법을 확인합니다'))
  .addSubcommand((sub) =>
    sub
      .setName('register')
      .setDescription('닉네임 또는 병영 URL로 계정을 연동합니다')
      .addStringOption((opt) =>
        opt.setName('nickname').setDescription('서든어택 닉네임 또는 병영 URL').setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName('profile').setDescription('서든어택 전적 이미지 카드를 출력합니다'))
  .addSubcommand((sub) =>
    sub
      .setName('search')
      .setDescription('닉네임으로 전적을 검색합니다')
      .addStringOption((opt) => opt.setName('nickname').setDescription('서든어택 닉네임').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('match')
      .setDescription('최근 매치 기록을 조회합니다')
      .addStringOption((opt) =>
        opt.setName('nickname').setDescription('닉네임 (미입력 시 연동 계정 사용)').setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('mode')
          .setDescription('매치 모드')
          .setRequired(false)
          .addChoices(
            { name: '폭파미션', value: '폭파미션' },
            { name: '데스매치', value: '데스매치' },
            { name: '개인전', value: '개인전' },
            { name: '진짜를 모아라', value: '진짜를 모아라' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('매치 타입')
          .setRequired(false)
          .addChoices(
            { name: '일반전', value: '일반전' },
            { name: '클랜전', value: '클랜전' },
            { name: '랭크전 솔로', value: '랭크전 솔로' },
            { name: '랭크전 파티', value: '랭크전 파티' },
            { name: '퀵매치 클랜전', value: '퀵매치 클랜전' },
            { name: '클랜 랭크전', value: '클랜 랭크전' },
            { name: '토너먼트', value: '토너먼트' }
          )
      )
      .addIntegerOption((opt) =>
        opt
          .setName('count')
          .setDescription('조회할 매치 수 (기본 20, 최대 30)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(30)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('오늘의 봇 및 서버 상태를 공지사항 채널에 전송합니다')
  );
