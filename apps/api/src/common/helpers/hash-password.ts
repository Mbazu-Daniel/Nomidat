import { hash, verify, type Options } from "@node-rs/argon2";

const argon2Options: Options = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
  algorithm: 2,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, argon2Options);
}

export async function verifyPassword(data: { password: string; hash: string }): Promise<boolean> {
  return verify(data.hash, data.password, argon2Options);
}
