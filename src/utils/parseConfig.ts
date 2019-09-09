import { Config } from "@clinq/bridge";
import { IPipelinerConfig } from "../models/pipelinerConfig.model";
import { anonymizeKey } from "./anonymize";
export const parseConfig = (config: Config): IPipelinerConfig => {
  const [token, password, spaceId] = config.apiKey.split(":");
  const anonKey = anonymizeKey(config.apiKey);
  return { token, password, spaceId, anonKey };
};
