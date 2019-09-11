import { Config } from "@clinq/bridge";
import axios from "axios";

export function createCacheClient(config: Config) {
  // const { BRIDGE_URL } = process.env;

  const BRIDGE_URL = "http://127.0.0.1:8080";

  return axios.create({
    baseURL: `${BRIDGE_URL}`,
    headers: {
      "X-Provider-URL": config.apiUrl,
      "X-Provider-Key": config.apiKey,
      "X-Provider-Locale": config.locale
    }
  });
}
export function getCachedContacts(config: Config) {
  return createCacheClient(config).get("/contacts");
}
