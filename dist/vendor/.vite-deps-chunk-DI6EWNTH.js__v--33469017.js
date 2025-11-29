import {
  asciiAlphanumeric,
  codes,
  values
} from "/vendor/.vite-deps-chunk-K5F3J5YU.js__v--33469017.js";

// node_modules/micromark-util-encode/index.js
var characterReferences = { '"': "quot", "&": "amp", "<": "lt", ">": "gt" };
function encode(value) {
  return value.replace(/["&<>]/g, replace);
  function replace(value2) {
    return "&" + characterReferences[
      /** @type {keyof typeof characterReferences} */
      value2
    ] + ";";
  }
}

// node_modules/micromark-util-sanitize-uri/dev/index.js
function sanitizeUri(url, protocol) {
  const value = encode(normalizeUri(url || ""));
  if (!protocol) {
    return value;
  }
  const colon = value.indexOf(":");
  const questionMark = value.indexOf("?");
  const numberSign = value.indexOf("#");
  const slash = value.indexOf("/");
  if (
    // If there is no protocol, it’s relative.
    colon < 0 || // If the first colon is after a `?`, `#`, or `/`, it’s not a protocol.
    slash > -1 && colon > slash || questionMark > -1 && colon > questionMark || numberSign > -1 && colon > numberSign || // It is a protocol, it should be allowed.
    protocol.test(value.slice(0, colon))
  ) {
    return value;
  }
  return "";
}
function normalizeUri(value) {
  const result = [];
  let index = -1;
  let start = 0;
  let skip = 0;
  while (++index < value.length) {
    const code = value.charCodeAt(index);
    let replace = "";
    if (code === codes.percentSign && asciiAlphanumeric(value.charCodeAt(index + 1)) && asciiAlphanumeric(value.charCodeAt(index + 2))) {
      skip = 2;
    } else if (code < 128) {
      if (!/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(code))) {
        replace = String.fromCharCode(code);
      }
    } else if (code > 55295 && code < 57344) {
      const next = value.charCodeAt(index + 1);
      if (code < 56320 && next > 56319 && next < 57344) {
        replace = String.fromCharCode(code, next);
        skip = 1;
      } else {
        replace = values.replacementCharacter;
      }
    } else {
      replace = String.fromCharCode(code);
    }
    if (replace) {
      result.push(value.slice(start, index), encodeURIComponent(replace));
      start = index + skip + 1;
      replace = "";
    }
    if (skip) {
      index += skip;
      skip = 0;
    }
  }
  return result.join("") + value.slice(start);
}

export {
  sanitizeUri,
  normalizeUri
};
//# sourceMappingURL=chunk-DI6EWNTH.js.map
