import type { DefaultSession, Session } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      discordId?: string;
      username?: string;
      serverNickname?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    discordId?: string;
    username?: string;
    serverNickname?: string;
    name?: string;
    displayName?: string;
    picture?: string;
  }
}
