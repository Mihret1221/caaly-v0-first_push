// Helper to validate password strength
const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true };
};

// Helper to validate email
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper to normalize phone number to +251 format
const normalizePhoneNumber = (phone: string): string | null => {
  
  const patterns = [
    /^09\d{8}$/,      
    /^9\d{8}$/,       
    /^\+2519\d{8}$/,  
    /^2519\d{8}$/     
  ];

  const isValid = patterns.some(pattern => pattern.test(phone));

  if (!isValid) {
    return null;
  }

  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("09")) {
    cleaned = "251" + cleaned.substring(1);
  } else if (cleaned.startsWith("9") && cleaned.length === 9) {
    cleaned = "251" + cleaned;
  }
  
  return "+" + cleaned;
};

export { validatePassword, validateEmail, normalizePhoneNumber };
