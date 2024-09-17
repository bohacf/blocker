const ITERATION_TIMES = 102400;
const SALT_LENGTH = 64;

const arrayBufferToHex = (buffer) => {
    return [...new Uint8Array(buffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

const hexToArrayBuffer = (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes.buffer;
};

const deriveKey = async (password, salt, ITERATIONS) => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey({
            name: 'PBKDF2',
            salt: salt,
            iterations: ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial, { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

const encryptData = async (key, data) => {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({
            name: 'AES-GCM',
            iv: iv,
        },
        key,
        enc.encode(data)
    );

    return new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
};

const decryptData = async (key, encryptedData) => {
    const iv = encryptedData.slice(0, 12);
    const data = encryptedData.slice(12);

    const decrypted = await crypto.subtle.decrypt({
            name: 'AES-GCM',
            iv: iv,
        },
        key,
        data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
};

const encrypt = async (content) => {
    if (!content) {
        return false;
    }
    let password = content;

    let salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

    const key = await deriveKey(password, salt, ITERATION_TIMES);
    const encryptedData = await encryptData(key, content);
    const encryptedObject = {
        data: arrayBufferToHex(encryptedData),
        salt: arrayBufferToHex(salt)
    }

    return encryptedObject;
};

const decrypt = async (encryptedContent, password, SALT) => {
    const dataHex = encryptedContent;
    const saltHex = SALT;

    if (!saltHex || !dataHex) {
        return false;
    }
    if (saltHex.length % 2 !== 0) {
        return false;
    }

    const salt = hexToArrayBuffer(saltHex);
    const content = hexToArrayBuffer(dataHex);
    const key = await deriveKey(password, salt, ITERATION_TIMES);

    try {
        await decryptData(key, content);
        return true;
    } catch (e) {
        return false;
    }
};

const pbkdf2 = { encrypt, decrypt };

export default pbkdf2;