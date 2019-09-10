import {Config} from "@clinq/bridge";
import axios from "axios";
import {parseConfig} from "./parseConfig";

export function createClient(config: Config) {
    const {apiUrl} = config;

    const {token, password, spaceId} = parseConfig(config);

    return axios.create({
        baseURL: `${apiUrl}/api/v100/rest/spaces/${spaceId}/entities`,
        auth: {
            username: token,
            password
        }
    });
}