import crypto from "crypto";
import fs from "fs";
import path from "path";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKeyPath(): string {
  const dir =
    process.env.QUERYBOX_USER_DATA ||
    path.join(
      process.env.HOME || process.env.USERPROFILE || ".",
      ".querybox"
    );
  return path.join(dir, ".encryption-key");
}

function getOrCreateKey(): Buffer {
  const keyPath = getKeyPath();
  const dir = path.dirname(keyPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, "utf-8"), "hex");
  }

  const key = crypto.randomBytes(KEY_LENGTH);
  fs.writeFileSync(keyPath, key.toString("hex"), { mode: 0o600 });
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const key = getOrCreateKey();
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(":");

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
