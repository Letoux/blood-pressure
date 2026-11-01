// Protection SSRF des envois Web Push : l'adresse d'un abonnement vient du navigateur, donc d'un
// utilisateur. Sans contrôle, `push.sendTest` et le worker feraient des requêtes vers le réseau
// local de l'instance (NAS, routeur, interface de Nginx Proxy Manager…).
// - À l'abonnement : `isAllowedPushEndpoint` refuse l'HTTP, les IP non publiques et les noms locaux.
// - À l'envoi : la même vérification, puis `pushAgent` refuse un nom qui résout vers une IP non
//   publique, au moment même de la connexion (pas de fenêtre entre vérification et connexion).

import dns, { type LookupAddress } from "node:dns";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

// Deux listes : une `BlockList` compare aussi une IPv4 aux règles IPv6 mappées (`::ffff:0:0/96`).
const nonPublicV4 = new BlockList();
const nonPublicV6 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // « ce réseau »
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // NAT des opérateurs
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // lien local, métadonnées des clouds
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // réservé, diffusion
] as const) {
  nonPublicV4.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127], // non spécifiée et boucle locale
  ["::ffff:0:0", 96], // IPv4 mappée : les services push n'en utilisent pas
  ["64:ff9b::", 96], // NAT64
  ["100::", 64],
  ["fc00::", 7], // unique locale
  ["fe80::", 10], // lien local
  ["ff00::", 8], // multicast
] as const) {
  nonPublicV6.addSubnet(network, prefix, "ipv6");
}

/** Vrai pour une adresse IP joignable sur Internet (ni privée, ni locale, ni réservée). */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return family === 6 ? !nonPublicV6.check(address, "ipv6") : !nonPublicV4.check(address, "ipv4");
}

const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

/**
 * Adresse acceptable pour un abonnement push : HTTPS, et un nom de domaine public ou une IP
 * publique. Les services push des navigateurs (FCM, Mozilla, Apple, Microsoft) en sont tous.
 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  // `URL` normalise déjà les IP (`3232235786` devient `192.168.1.10`) ; IPv6 entre crochets.
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  if (isIP(host)) return isPublicAddress(host);
  if (host === "localhost" || !host.includes(".")) return false;
  return !LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

type Lookup = (
  hostname: string,
  options: dns.LookupAllOptions,
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

/** Résolution DNS qui échoue si l'une des adresses obtenues n'est pas publique. */
export function createPublicOnlyLookup(lookup: Lookup = dns.lookup): LookupFunction {
  return (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, "", 4);
      const refused = addresses.find(({ address }) => !isPublicAddress(address));
      if (refused || addresses.length === 0) {
        return callback(new Error(`Service push refusé : ${hostname} résout vers une adresse non publique.`), "", 4);
      }
      if ((options as dns.LookupOptions).all) {
        return (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, addresses);
      }
      const [first] = addresses;
      callback(null, first!.address, first!.family);
    });
  };
}

/** Agent HTTPS des envois push : ne se connecte qu'à des adresses publiques. */
export const pushAgent = new https.Agent({ lookup: createPublicOnlyLookup() });
