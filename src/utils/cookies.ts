export function setCookie(name: string, value: string, days: number): boolean {
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

    const encodedValue = encodeURIComponent(value);
    const isSecure = window.location.protocol === 'https:';

    let cookieString = `${name}=${encodedValue}`;
    cookieString += `;expires=${expires.toUTCString()}`;
    cookieString += `;path=/`;
    cookieString += `;SameSite=Strict`;

    if (isSecure) {
      cookieString += `;Secure`;
    }

    document.cookie = cookieString;

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

export function getCookie(name: string): string | null {
  try {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        const value = c.substring(nameEQ.length, c.length);
        return decodeURIComponent(value);
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting cookie:', error);
    return null;
  }
}

export function deleteCookie(name: string): boolean {
  try {
    const isSecure = window.location.protocol === 'https:';

    let cookieString = `${name}=`;
    cookieString += `;expires=Thu, 01 Jan 1970 00:00:00 UTC`;
    cookieString += `;path=/`;
    cookieString += `;SameSite=Strict`;

    if (isSecure) {
      cookieString += `;Secure`;
    }

    document.cookie = cookieString;

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
