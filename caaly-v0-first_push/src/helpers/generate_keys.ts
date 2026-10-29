import {generateKeyPair , exportJWK, exportPKCS8, exportSPKI , importPKCS8} from "jose";
import * as fs from "fs";

async function main() {
    console.log("Generating RSA key Pair for Fayda....")
    const {publicKey , privateKey} = await generateKeyPair("RS256",{
      modulusLength: 2048,
      extractable: true
    });
    const privateJwk = await exportJWK(privateKey);
    privateJwk.kid = "fayda-key-v1";
    privateJwk.use = "sig";
    privateJwk.alg = "RS256";

    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "fayda-key-v1";
    publicJwk.use = "sig";
    publicJwk.alg = "RS256";

fs.writeFileSync('private-key.json', JSON.stringify(privateJwk, null, 2));
fs.writeFileSync('public-jwks.json', JSON.stringify({ keys: [publicJwk] }, null, 2));

// ----- PEM Export -----
  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  fs.writeFileSync("private-key.pem", privatePem);
  fs.writeFileSync("public-key.pem", publicPem);

  console.log("Keys generated: JWK (JSON) and PEM formats");
}

main().catch(console.error);