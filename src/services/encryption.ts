import CryptoJS from 'crypto-js';

// In a real app, this would be derived from the user's PIN or a separate key
// For this demo, we'll use a constant key, but emphasize it should be secure.
const SECRET_KEY = 'calculator-vault-secret-key';

export const encryptFile = (fileData: string): string => {
  return CryptoJS.AES.encrypt(fileData, SECRET_KEY).toString();
};

export const decryptFile = (encryptedData: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
