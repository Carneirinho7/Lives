import "server-only";
import { scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

/** Better Auth's default password format: saltHex:keyHex, with scrypt N=16384,r=16,p=1. */
export async function verifyBetterAuthPassword(password: string, encoded: string) {
  const match = /^([a-f\d]{32}):([a-f\d]{128})$/i.exec(encoded);
  if (!match || password.length > 128) return false;

  try {
    const expected = Buffer.from(match[2], "hex");
    const actual = await new Promise<Buffer>((resolve, reject) => {
      // Better Auth passes its hex salt as a UTF-8 string to node:scrypt.
      nodeScrypt(password.normalize("NFKC"), match[1], 64, {
        N: 16384,
        r: 16,
        p: 1,
        maxmem: 64 * 1024 * 1024,
      }, (error, key) => error ? reject(error) : resolve(key));
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
