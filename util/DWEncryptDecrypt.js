const crypto = require("crypto");

const DREAMWEAVER_CONSTANTS = {

    ENCRYPT_METHOD: 'aes-256-cbc'

};

function dreamWeaverEncryptDecrypt(action, secret_key, secret_iv, string) {

    const key = crypto.createHash('sha256').update(String(secret_key)).digest('hex').substring(0, 32);

    const iv = crypto.createHash('sha256').update(String(secret_iv)).digest('hex').substring(0, 16);

    switch (action) {

        case 'encrypt':

            const cipher = crypto.createCipheriv(DREAMWEAVER_CONSTANTS.ENCRYPT_METHOD, key, iv);

            let encrypted = cipher.update(string, 'utf8', 'base64');

            encrypted += cipher.final('base64');

            const encBuffer = Buffer.from(encrypted, 'utf-8');

            return encBuffer.toString('base64');

        case 'decrypt':

            const response = string.payload;

            const base64Decoded = Buffer.from(response, 'base64').toString('utf-8');

            const decipher = crypto.createDecipheriv(DREAMWEAVER_CONSTANTS.ENCRYPT_METHOD, key, iv);

            let decrypted = decipher.update(base64Decoded, 'base64', 'utf-8');

            decrypted += decipher.final('utf-8');

            return decrypted;


        default:

            console.warn("[ENCRYPT_DECRYPT] Invalid action provided");

            return false;

    }

}

module.exports = dreamWeaverEncryptDecrypt;