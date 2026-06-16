import type { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

const adminRoleIds = (process.env.DISCORD_ADMIN_ROLE_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

async function fetchDiscordUser(accessToken: string) {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
}

function discordAvatarUrl(userId: string, avatar: string | null | undefined) {
  if (!avatar) {
    const index = Number(BigInt(userId) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=128`;
}

async function fetchGuildMember(accessToken: string) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return null;

  const res = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return null;
  return (await res.json()) as { nick?: string | null; roles: string[] };
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds guilds.members.read',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;

        const discordUser = await fetchDiscordUser(account.access_token);

        if (discordUser) {
          token.discordId = discordUser.id;
          token.username = discordUser.username;
          // Discord 좌하단 패널과 동일: 전역 표시 이름(global_name) 우선
          token.displayName =
            discordUser.global_name?.trim() || discordUser.username;
          token.name = token.displayName;
          token.picture = discordAvatarUrl(discordUser.id, discordUser.avatar);
        }
      } else if (token.accessToken) {
        const discordUser = await fetchDiscordUser(token.accessToken as string);
        if (discordUser) {
          token.discordId = discordUser.id;
          token.username = discordUser.username;
          token.displayName =
            discordUser.global_name?.trim() || discordUser.username;
          token.name = token.displayName;
          token.picture = discordAvatarUrl(discordUser.id, discordUser.avatar);
        }
      } else if (user) {
        if (!token.picture && user.image) token.picture = user.image;
        if (!token.name && user.name) token.name = user.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = token.discordId as string;
        session.user.username = token.username as string;
        session.user.name =
          (token.displayName as string) ??
          (token.name as string) ??
          session.user.name;
        session.user.image = (token.picture as string) ?? session.user.image;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
    async signIn({ account }) {
      if (!account?.access_token) return false;

      const member = await fetchGuildMember(account.access_token);
      if (!member) return false;

      const isAdmin = adminRoleIds.some((roleId) => member.roles.includes(roleId));
      return isAdmin;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
