// 安全密码加密/解密工具
// 使用 AES-GCM 对称加密

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
 * 设置 Cookie
 */
function setCookie(name: string, value: string, days: number): boolean {
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

    // Encode value to handle special characters
    const encodedValue = encodeURIComponent(value);

    // Check if running on HTTPS
    const isSecure = window.location.protocol === 'https:';

    // Build cookie string with all necessary attributes
    let cookieString = `${name}=${encodedValue}`;
    cookieString += `;expires=${expires.toUTCString()}`;
    cookieString += `;path=/`;
    cookieString += `;SameSite=Strict`;

    // Add Secure flag for HTTPS
    if (isSecure) {
      cookieString += `;Secure`;
    }

    document.cookie = cookieString;

    // Verify cookie was set by reading it back
    const cookieSet = getCookie(name) === value;
    if (!cookieSet) {
      console.error(`Failed to set cookie: ${name}`);
    }
    return cookieSet;
  } catch (error) {
    console.error('Error setting cookie:', error);
    return false;
  }
}

/**
 * 获取 Cookie
 */
function getCookie(name: string): string | null {
  try {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        const value = c.substring(nameEQ.length, c.length);
        // Decode value
        return decodeURIComponent(value);
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting cookie:', error);
    return null;
  }
}

/**
 * 删除 Cookie
 */
function deleteCookie(name: string): boolean {
  try {
    const isSecure = window.location.protocol === 'https:';

    // Set cookie with past expiration date and same attributes
    let cookieString = `${name}=`;
    cookieString += `;expires=Thu, 01 Jan 1970 00:00:00 UTC`;
    cookieString += `;path=/`;
    cookieString += `;SameSite=Strict`;

    if (isSecure) {
      cookieString += `;Secure`;
    }

    document.cookie = cookieString;

    // Verify cookie was deleted
    const cookieDeleted = getCookie(name) === null;
    if (!cookieDeleted) {
      console.error(`Failed to delete cookie: ${name}`);
    }
    return cookieDeleted;
  } catch (error) {
    console.error('Error deleting cookie:', error);
    return false;
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
