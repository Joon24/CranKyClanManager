import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      discordId?: string;
      username?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    discordId?: string;
    username?: string;
    name?: string;
    displayName?: string;
    picture?: string;
  }
}
