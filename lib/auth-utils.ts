import crypto from 'crypto';

export function isWeakPassword(password: string): boolean {
  const p = password.toLowerCase();
  
  // Reject simple sequential patterns
  const sequences = ["12345678", "abcdefgh", "qwertyui", "asdfghjk", "password"];
  for (const seq of sequences) {
    if (p.includes(seq)) return true;
  }
  
  // Reject repeating patterns of same character (e.g. 8 times of a single character)
  if (/^(.)\1{7,}$/.test(p)) return true;
  
  // Reject common words
  const weakWords = ["admin", "superadmin", "driver", "smartforce", "fleet", "taxi"];
  for (const word of weakWords) {
    if (p === word || p === word + "123" || p === word + "123!") {
      return true;
    }
  }

  return false;
}

export function hashPassword(password: string): string {
  // Passwords are stored in readable plain text form so admins can view them
  return password;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  
  // Direct readable plain text check
  if (password === storedHash) return true;

  // Fallback for legacy hashed passwords
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === checkHash;
  } catch (error) {
    return false;
  }
}
