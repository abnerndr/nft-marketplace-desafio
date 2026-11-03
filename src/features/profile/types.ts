import { z } from "zod";

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string(),
  ens: z.string(),
  walletNickname: z.string(),
  /** Data URL da imagem enviada, ou `null` sem avatar. */
  avatarUrl: z.string().nullable(),
});

export const profileResponseSchema = z.object({ profile: profileSchema });

export type Profile = z.infer<typeof profileSchema>;

export type ProfileUpdate = Partial<Pick<Profile, "name" | "username" | "email" | "ens" | "walletNickname">>;

export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/** Mesmo limite do handler: o servidor confere de novo. */
export const MAX_AVATAR_BYTES = 200 * 1024;
export const MIN_PASSWORD_LENGTH = 8;
