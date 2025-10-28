import * as crypto from 'crypto';

function getKey(varName: string, fallback?: string) {
  const v = process.env[varName] || fallback;
  if (!v) throw new Error(`Missing required env ${varName}`);
  const buf = Buffer.from(v, 'base64');
  if (buf.length !== 32) throw new Error(`${varName} must be 32 bytes, base64-encoded`);
  return buf;
}

export function encrypt(value: string) {
  const key = getKey('DATA_ENC_KEY', process.env.NODE_ENV === 'production' ? undefined : Buffer.from('dev_enc_key_32_bytes_dev_enc_key_32_b').toString('base64'));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decrypt(b64: string) {
  const key = getKey('DATA_ENC_KEY', process.env.NODE_ENV === 'production' ? undefined : Buffer.from('dev_enc_key_32_bytes_dev_enc_key_32_b').toString('base64'));
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString('utf8');
}

export function blindIndex(value: string) {
  const key = getKey('DATA_HMAC_KEY', process.env.NODE_ENV === 'production' ? undefined : Buffer.from('dev_hmac_key_32_bytes_dev_hmac_key_32').toString('base64'));
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

