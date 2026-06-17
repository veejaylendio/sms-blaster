import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates and normalizes a Philippine phone number.
 * Accepts:
 * - 09XXXXXXXXX (11 digits)
 * - +63XXXXXXXXXX (13 characters including +)
 * Normalizes to: +63XXXXXXXXXX
 */
export function validateAndNormalizePhoneNumber(phone: string): { 
  isValid: boolean; 
  normalized?: string; 
  error?: string; 
} {
  // Remove all spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, '');

  // Check for invalid characters (only digits and a leading plus are allowed)
  if (!/^\+?\d+$/.test(cleaned)) {
    return { 
      isValid: false, 
      error: 'The number contains invalid characters.' 
    };
  }

  if (cleaned.startsWith('09')) {
    if (cleaned.length !== 11) {
      return { 
        isValid: false, 
        error: 'Numbers starting with 09 must contain exactly 11 digits.' 
      };
    }
    // Convert 09... to +639...
    return { 
      isValid: true, 
      normalized: '+63' + cleaned.substring(1) 
    };
  } else if (cleaned.startsWith('+63')) {
    if (cleaned.length !== 13) {
      return { 
        isValid: false, 
        error: 'Numbers starting with +63 must contain exactly 13 characters.' 
      };
    }
    return { 
      isValid: true, 
      normalized: cleaned 
    };
  } else {
    return { 
      isValid: false, 
      error: 'The number must start with 09 or +63.' 
    };
  }
}
