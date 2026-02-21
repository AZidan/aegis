// Pure JavaScript TOTP generator for Maestro's GraalJS engine (no Node.js APIs)
// Implements RFC 6238 (TOTP) + RFC 4226 (HOTP) + HMAC-SHA1

// --- Base32 Decoder ---
function base32Decode(encoded) {
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var bits = '';
  for (var i = 0; i < encoded.length; i++) {
    var val = alphabet.indexOf(encoded.charAt(i).toUpperCase());
    if (val === -1) continue;
    bits += ('00000' + val.toString(2)).slice(-5);
  }
  var bytes = [];
  for (var i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return bytes;
}

// --- SHA-1 Implementation ---
function sha1(msgBytes) {
  function leftRotate(n, s) {
    return ((n << s) | (n >>> (32 - s))) & 0xFFFFFFFF;
  }

  var h0 = 0x67452301;
  var h1 = 0xEFCDAB89;
  var h2 = 0x98BADCFE;
  var h3 = 0x10325476;
  var h4 = 0xC3D2E1F0;

  // Pre-processing: adding padding bits
  var msgLen = msgBytes.length;
  var bitLen = msgLen * 8;
  msgBytes.push(0x80);
  while (msgBytes.length % 64 !== 56) {
    msgBytes.push(0);
  }
  // Append original length in bits as 64-bit big-endian
  for (var i = 56; i >= 0; i -= 8) {
    msgBytes.push((bitLen / Math.pow(2, i)) & 0xFF);
  }

  // Process each 512-bit chunk
  for (var chunk = 0; chunk < msgBytes.length; chunk += 64) {
    var w = [];
    for (var i = 0; i < 16; i++) {
      w[i] = (msgBytes[chunk + i * 4] << 24) |
              (msgBytes[chunk + i * 4 + 1] << 16) |
              (msgBytes[chunk + i * 4 + 2] << 8) |
              (msgBytes[chunk + i * 4 + 3]);
    }
    for (var i = 16; i < 80; i++) {
      w[i] = leftRotate((w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16]) & 0xFFFFFFFF, 1);
    }

    var a = h0, b = h1, c = h2, d = h3, e = h4;

    for (var i = 0; i < 80; i++) {
      var f, k;
      if (i < 20) {
        f = (b & c) | ((~b) & d);
        k = 0x5A827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8F1BBCDC;
      } else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }
      var temp = (leftRotate(a, 5) + f + e + k + w[i]) & 0xFFFFFFFF;
      e = d;
      d = c;
      c = leftRotate(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) & 0xFFFFFFFF;
    h1 = (h1 + b) & 0xFFFFFFFF;
    h2 = (h2 + c) & 0xFFFFFFFF;
    h3 = (h3 + d) & 0xFFFFFFFF;
    h4 = (h4 + e) & 0xFFFFFFFF;
  }

  // Convert to byte array
  var hash = [];
  var vals = [h0, h1, h2, h3, h4];
  for (var v = 0; v < vals.length; v++) {
    hash.push((vals[v] >>> 24) & 0xFF);
    hash.push((vals[v] >>> 16) & 0xFF);
    hash.push((vals[v] >>> 8) & 0xFF);
    hash.push(vals[v] & 0xFF);
  }
  return hash;
}

// --- HMAC-SHA1 ---
function hmacSha1(keyBytes, msgBytes) {
  var blockSize = 64;

  // If key is longer than block size, hash it
  if (keyBytes.length > blockSize) {
    keyBytes = sha1(keyBytes.slice());
  }
  // Pad key to block size
  while (keyBytes.length < blockSize) {
    keyBytes.push(0);
  }

  var ipad = [];
  var opad = [];
  for (var i = 0; i < blockSize; i++) {
    ipad.push(keyBytes[i] ^ 0x36);
    opad.push(keyBytes[i] ^ 0x5C);
  }

  // inner hash: SHA1(ipad + message)
  var inner = ipad.concat(msgBytes);
  var innerHash = sha1(inner);

  // outer hash: SHA1(opad + innerHash)
  var outer = opad.concat(innerHash);
  return sha1(outer);
}

// --- TOTP ---
function generateTOTP(secret, timeStep, digits) {
  timeStep = timeStep || 30;
  digits = digits || 6;

  var keyBytes = base32Decode(secret);
  var epoch = Math.floor(Date.now() / 1000);
  var counter = Math.floor(epoch / timeStep);

  // Convert counter to 8-byte big-endian
  var counterBytes = [0, 0, 0, 0, 0, 0, 0, 0];
  for (var i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xFF;
    counter = Math.floor(counter / 256);
  }

  var hmac = hmacSha1(keyBytes.slice(), counterBytes);

  // Dynamic truncation
  var offset = hmac[19] & 0x0F;
  var code = ((hmac[offset] & 0x7F) << 24) |
             ((hmac[offset + 1] & 0xFF) << 16) |
             ((hmac[offset + 2] & 0xFF) << 8) |
             (hmac[offset + 3] & 0xFF);

  code = code % Math.pow(10, digits);
  var codeStr = code.toString();
  while (codeStr.length < digits) {
    codeStr = '0' + codeStr;
  }
  return codeStr;
}

// Generate and set output — individual digits for one-at-a-time entry
var totp = generateTOTP('JBSWY3DPEHPK3PXP');
output.totp = totp;
output.d1 = totp.charAt(0);
output.d2 = totp.charAt(1);
output.d3 = totp.charAt(2);
output.d4 = totp.charAt(3);
output.d5 = totp.charAt(4);
output.d6 = totp.charAt(5);
