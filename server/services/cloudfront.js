import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

const keyPairId = "K176HUBFCYBM2V";
const distributionName = "https://d1ie6sass83b7z.cloudfront.net";

export const createCloudFrontGetSignedUrl = ({
  key,
  download = false,
  filename,
}) => {
  const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDv8K+Rrux3lzNS
rCJiPcGgc8M/71nFAJuTp6QfX+TEBqW5Nx/+tedRYs1kSeAkEXEocWSGV9vzOGic
qUXX17N++rabdDVLNc82gMWOM2XHwNyzepIn+eFX+aLTXbBszJ7b+DUyqCQ3hZPf
sSWM5TUbwf6vQ2fUydG/j1jxHn6DSOok1HJwmfbsNpf7Wj1YLRiI0EpDr6MNk6tb
5LhA6rty8c9DZ/fU5t+Qx6ilopD+Oa66kZrIaFGDKDYsrHP95189UJTmw5kW67Bf
b+KArEZzCNuVU/wNNwdQYXiPJx6QtsHA3DeSg5WDcBQfFoCnlpiw+Dv0s5WBekY8
XkDLHmWjAgMBAAECggEAFWY88lxMgLn+fNAXXPWvEDVi44/gTL6qIXghHh86UvVY
0HUHKHtmvw51zQz9rZnUosvCMG0jk8SjJ928+ewl+Rw5LxIlMqkA6xZ/CBizaiZc
SLGU2XXi0CrWh81iT8HMJUg0zmjKmh0SvC+bbr5+hxQ9N7pmR0ccqt4JC7AxjlnF
Nj6uqItGxunD5/d7PgLNt0DsII57zloIlUvlWPkL3n/54H2V4P6td+2CNHY6GiWa
KOkU29HgrPYmib1xFSle4Wv1cGWFIhPzHZoNYqwTgHBP8wTf0ldkOOR7l/kxCAb5
/RQwDWmcuC+z0M50ivrrwxiX8ddosTyou6Q/ic3+KQKBgQD+/k18LDFIVUCPsgad
KaYmXOHMHwogK1EFDl/bjae+y+r6JuFdyld6F8DLQ8AOuWD+L8rJkLvnw4sLwZdn
gwv6zFUgBTpVau3BxXh++CO48Pam9lB3nW3SwjBXY4eEWrqgg0+Cu/23ES3fhDUv
/iEeI4eq5rbGEzNp4w50+6jfHwKBgQDw4yuadNo8h/VW6nFmNxwL91iOG8XGS91Y
8N1v/8J9e4q8Y4vMKihzVItCu4VIIeiTLMZ6G3qi/+rMQdNFkPSH1t0cTj6yXgcT
zkEDlW8CxuLXwS8aesUbfY/BigSOjQ4hU1p21lzHz7/GTI6nGbFzGyekFngI6M78
kjTPAV2c/QKBgQDwxLvzKGMsUlsQk19NXHsmtAL8Ur6j22K37He0fk/Khw8LPlUD
0z+/59fB1entvTqJKCVJJ6FVWDzdT+Ee+wz/tZoXDviimMGAem2pLbHFObkbs24N
U5fULkmo6jCWV3jqgLI91jXdepoe992kwEcTByddxlUEODMOozcOXGV6rwKBgQCY
iYHnAO/hPMbjDvpYG7Wq7iopcvS+KPQ1ifDvJynlhAHKYc74rgmHXpYA3/X6Q16f
M89LK3NxHFV2mohKmQv/qNPDRNj24gvhQs5wkoQFYiPrM+27+touGkiZ6egQzMmR
2NKERiHidW+fBoOe1OpFVYC4q3G/Uo0f6wV9wAOjkQKBgE6H0pEyJfnWdq6NxSK6
nbqmpBLnHZBkSyE5yv2+JdXrKe4EGgfSKGs+R+9ajE9I1OBqX0arSNQLHRd5u9OI
yGJ6+cdTFZFHvm59yCG3y0VxcuyRTWNs50n9sl2ozyecIzZVnkdFjie3kkIhqDto
Qk+EInwpZcvB0B9PA+/Mu84Q
-----END PRIVATE KEY-----`;

  if (!privateKey) {
    throw new Error("Missing CLOUDFRONT_PRIVATE_KEY");
  }

  const dateLessThan = new Date(Date.now() + 1000 * 60 * 60).toISOString();

  const disposition = `${download ? "attachment" : "inline"}; filename="${filename}"`;

  const url = `${distributionName}/${key}?response-content-disposition=${encodeURIComponent(disposition)}`;

  return getSignedUrl({
    url,
    keyPairId,
    dateLessThan,
    privateKey,
  });
};