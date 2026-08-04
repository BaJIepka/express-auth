export type SafeUser = {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
};

export function toSafeUser(user: {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
}): SafeUser {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}
