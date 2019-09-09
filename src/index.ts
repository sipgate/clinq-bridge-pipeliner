import {
  Adapter,
  Config,
  Contact,
  ContactUpdate,
  ServerError,
  start
} from "@clinq/bridge";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { IPipelinerContactsGet, IPipelinerContactsPatch } from "./models";
import {
  convertToClinqContact,
  convertToPipelinerContact,
  parseConfig
} from "./utils";

class MyAdapter implements Adapter {
  public async createClient(config: Config) {
    const { apiKey, apiUrl } = config;
    if (typeof apiKey !== "string") {
      throw new Error("Invalid API key.");
    }

    const { token, password, spaceId } = parseConfig(config);

    return axios.create({
      baseURL: `${apiUrl}/api/v100/rest/spaces/${spaceId}/entities`,
      auth: {
        username: token,
        password
      }
    });
  }

  public async getContacts(config: Config): Promise<Contact[]> {
    const { spaceId, anonKey } = parseConfig(config);
    try {
      const client = await this.createClient(config);
      const contacts: Contact[] = await this.fetchContacts(spaceId, client);

      return contacts;
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error("Could not fetch contacts for {}", anonKey);
      throw new ServerError(400, "Could not fetch contacts");
    }
  }

  public async updateContact(
    config: Config,
    id: string,
    contact: ContactUpdate
  ) {
    const { anonKey, spaceId } = parseConfig(config);

    try {
      const client = await this.createClient(config);

      const pipelinerContact = convertToPipelinerContact(contact);

      const {
        data
      }: AxiosResponse<IPipelinerContactsPatch> = await client.patch(
        `/Contacts/${id}`,
        pipelinerContact
      );

      return convertToClinqContact(data.data, spaceId);
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(`Could not update contact ${id} for ${anonKey}`);
      throw new ServerError(400, "Could not fetch contacts");
    }
  }

  private async fetchContacts(
    spaceId: string,
    client: AxiosInstance,
    accumulated: Contact[] = []
  ): Promise<Contact[]> {
    const { data }: AxiosResponse<IPipelinerContactsGet> = await client.get(
      "/Contacts",
      {
        params: {
          "order-by": "-created",
          limit: 2,
          offset: accumulated.length
        }
      }
    );

    const contacts = data.data.map(contact =>
      convertToClinqContact(contact, spaceId)
    );
    const mergedContacts = [...accumulated, ...contacts];
    const more = Boolean(mergedContacts.length < Number(data.total));

    if (more) {
      return this.fetchContacts(spaceId, client, mergedContacts);
    } else {
      return mergedContacts;
    }
  }
}

start(new MyAdapter());
