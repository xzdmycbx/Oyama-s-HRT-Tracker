// 安全密码加密/解密工具
// 使用 AES-GCM 对称加密

import { deleteCookie, getCookie, setCookie } from './cookies';

const SECURITY_PASSWORD_COOKIE = 'hrt-security-pwd';
const SALT = 'hrt-tracker-security-salt-v1'; // 固定salt

/**
 * 从用户名派生加密密钥
 */
async function deriveKey(username: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(username + SALT),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密安全密码
 */
async function encryptPassword(password: string, username: string): Promise<string> {
  const key = await deriveKey(username);
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  // 将 IV 和加密数据组合在一起
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // 转换为 Base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * 解密安全密码
 */
async function decryptPassword(encryptedData: string, username: string): Promise<string | null> {
  try {
    const key = await deriveKey(username);

    // 从 Base64 解码
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // 分离 IV 和加密数据
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Failed to decrypt password:', error);
    return null;
  }
}

/**
 * 保存安全密码到 Cookie（加密，7天过期）
 * @returns true if saved successfully, false otherwise
 */
export async function saveSecurityPassword(password: string, username: string): Promise<boolean> {
  try {
    const encrypted = await encryptPassword(password, username);
    const saved = setCookie(SECURITY_PASSWORD_COOKIE, encrypted, 7); // 7天过期，与 refresh token 一致

    if (saved) {
      console.log('Security password saved to cookie successfully');
    } else {
      console.error('Failed to save security password to cookie');
    }

    return saved;
  } catch (error) {
    console.error('Failed to save security password:', error);
    return false;
  }
}

/**
 * 从 Cookie 获取安全密码（解密）
 */
export async function getSecurityPassword(username: string): Promise<string | null> {
  try {
    const encrypted = getCookie(SECURITY_PASSWORD_COOKIE);
    if (!encrypted) return null;

    return await decryptPassword(encrypted, username);
  } catch (error) {
    console.error('Failed to get security password:', error);
    return null;
  }
}

/**
 * 清除安全密码 Cookie
 * @returns true if deleted successfully, false otherwise
 */
export async function clearSecurityPassword(): Promise<boolean> {
  return deleteCookie(SECURITY_PASSWORD_COOKIE);
}
