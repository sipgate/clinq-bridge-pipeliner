import {
  Adapter,
  CallDirection,
  CallEvent,
  Channel,
  Config,
  Contact,
  ContactTemplate,
  ContactUpdate,
  ServerError,
  start,
} from "@clinq/bridge";
import { AxiosInstance, AxiosResponse } from "axios";
import * as moment from "moment";
import {
  IPipelinerAccountsGet,
  IPipelinerAccountsPost,
  IPipelinerClient,
  IPipelinerClientsGet,
  IPipelinerContact,
  IPipelinerContactsGet,
  IPipelinerContactsPatch,
  IPipelinerContactsPost,
  IPipelinerNotePost,
  IPipelinerResponse,
} from "./models";
import { INoteTemplate as IPipelinerNote } from "./models/note.model";
import {
  IPipelinerAccount,
  IPipelinerAccountTemplate,
} from "./models/pipelinerAccount.model";
import {
  convertToClinqContact,
  convertToPipelinerContact,
  parseConfig,
} from "./utils";
import { getCachedContacts } from "./utils/cacheClient";
import { formatDuration } from "./utils/duration";
import { createClient } from "./utils/httpClient";
import { normalizePhoneNumber, parsePhoneNumber } from "./utils/phone-number";

class MyAdapter implements Adapter {
  public async createContact(config: Config, contact: ContactTemplate) {
    const { spaceId, anonKey } = parseConfig(config);

    /*
     * Add logic for creating account and ContactAccountRelation
     * if CLINQ customer dont like the "UNKNOWN" in contacts and notes
     */
    // let account = null;

    try {
      const client = await createClient(config);
      const pipelinerClient: IPipelinerClient = await fetchFirstClient(config);

      /*
       * Add logic for creating account and ContactAccountRelation
       * if CLINQ customer dont like the "UNKNOWN" in contacts and notes
       */

      // if (contact.organization) {
      //   account = await this.findAccountByOrganizationname(
      //     config,
      //     contact.organization
      //   );

      //   if (!account) {
      //     account = await this.createAccount(config, contact.organization);
      //   }
      // }

      // const pipelinerContact = {
      //   ...convertToPipelinerContact(contact),
      //   owner_id: pipelinerClient.id
      // };

      const pipelinerContact = {
        ...convertToPipelinerContact(contact),
        owner_id: pipelinerClient.id,
      };

      const {
        data: contactsPostResponse,
      }: AxiosResponse<IPipelinerContactsPost> = await client.post(
        "/Contacts",
        pipelinerContact
      );

      return convertToClinqContact(contactsPostResponse.data, spaceId);
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(`Could not create contact ${contact.email} for ${anonKey}`);
      throw new ServerError(400, "Could not fetch contacts");
    }
  }

  public async getContacts(config: Config): Promise<Contact[]> {
    const { spaceId, anonKey } = parseConfig(config);
    try {
      const client = await createClient(config);
      return await this.fetchContacts(spaceId, client);
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
      const client = createClient(config);

      const pipelinerContact = convertToPipelinerContact(contact);

      const { data }: AxiosResponse<IPipelinerContactsPatch> =
        await client.patch(`/Contacts/${id}`, pipelinerContact);

      return convertToClinqContact(data.data, spaceId);
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(`Could not update contact ${id} for ${anonKey}`);
      throw new ServerError(400, "Could not fetch contacts");
    }
  }

  public async deleteContact(config: Config, id: string) {
    const { anonKey } = parseConfig(config);

    try {
      const client = createClient(config);

      const response: AxiosResponse<IPipelinerResponse> = await client.delete(
        `Contacts/${id}`
      );

      if (response.status >= 300 || !response.data.success) {
        return;
      }
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(`Could not delete contact ${id} for ${anonKey}`);
      throw new ServerError(400, "Could not delete contact");
    }

    return;
  }

  public async handleCallEvent(
    config: Config,
    callEvent: CallEvent
  ): Promise<void> {
    const { direction, from, to, channel } = callEvent;
    const { anonKey } = parseConfig(config);

    try {
      const phoneNumber = direction === CallDirection.IN ? from : to;

      const contact: Contact = await this.getContactByPhoneNumber(
        config,
        phoneNumber
      );

      const owner = await this.getNoteOwner(config, callEvent.user.email);

      const comment: IPipelinerNote = this.parseCallComment(
        contact,
        channel,
        callEvent,
        config.locale,
        owner
      );
      await this.createCallComment(config, comment);
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(`Could not save CallEvent for ${anonKey}: ${error}`);
      throw new ServerError(400, "Could not save CallEvent");
    }
  }

  private async createAccount(
    config: Config,
    name: string
  ): Promise<IPipelinerAccount> {
    const { anonKey } = parseConfig(config);
    const client = createClient(config);

    try {
      const pipelinerClient: IPipelinerClient = await fetchFirstClient(config);
      const pipelinerAccount: IPipelinerAccountTemplate = {
        name,
        owner_id: pipelinerClient.id,
      };

      const {
        data: { data },
      }: AxiosResponse<IPipelinerAccountsPost> = await client.post(
        "/Accounts",
        pipelinerAccount
      );

      // tslint:disable-next-line:no-console
      console.log(`Created account (${data.id}) for ${anonKey}`);

      return data;
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(`Could not create account for ${anonKey}: ${error}`);
      throw new ServerError(400, "Could not create account");
    }
  }

  private async getNoteOwner(
    config: Config,
    term: string
  ): Promise<IPipelinerClient> {
    const pipelinerClients = await fetchClients(config);
    return (
      pipelinerClients
        .filter((pipelinerClient) => pipelinerClient.email === term)
        .find(Boolean) || pipelinerClients[0]
    );
  }

  private async findAccountByOrganizationname(config: Config, name: string) {
    const { anonKey } = parseConfig(config);
    const client = createClient(config);

    try {
      const {
        data: { data: organizations },
      }: AxiosResponse<IPipelinerAccountsGet> = await client.get(
        `/Accounts?filter${encodeURI("[name]")}=${name}`
      );
      return organizations.find(Boolean);
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(
        `Could not find account by name "${name}" for key "${anonKey}: ${error.message}"`
      );
      throw new ServerError(400, "Could not find account");
    }
  }

  private async createCallComment(
    config: Config,
    comment: IPipelinerNote
  ): Promise<IPipelinerNote> {
    const { anonKey } = parseConfig(config);
    try {
      const client = createClient(config);
      const { data: note }: IPipelinerNotePost = await client.post(
        "/Notes",
        comment
      );
      // tslint:disable-next-line:no-console
      console.log(`Created call note for ${anonKey}`);
      return note;
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(
        `Could not create call note for key "${anonKey}: ${error.message}"`
      );
      throw new ServerError(400, "Could not create call note");
    }
  }

  private parseCallComment(
    contact: Contact,
    channel: Channel,
    callEvent: CallEvent,
    locale: string,
    owner: IPipelinerClient
  ): IPipelinerNote {
    const { end, direction } = callEvent;
    const date = moment(Number(callEvent.start));

    const duration = formatDuration(Number(end) - Number(callEvent.start));
    const isGerman = locale === "de_DE";

    const directionInfo =
      direction === CallDirection.IN
        ? isGerman
          ? "Eingehender"
          : "Incoming"
        : isGerman
        ? "Ausgehender"
        : "Outgoing";

    const textEN = `<div><strong>${directionInfo}</strong> CLINQ call in <strong>"${
      channel.name
    }"</strong> on ${date.format("YYYY-MM-DD")} (${duration})<div>`;
    const textDE = `<div><strong>${directionInfo}</strong> CLINQ Anruf in <strong>"${
      channel.name
    }"</strong> am ${date.format("DD.MM.YYYY")} (${duration})<div>`;

    return {
      owner_id: owner.id,
      contact_id: contact.id,
      note: isGerman ? textDE : textEN,
    };
  }

  private async findContactInCache(config: Config, phoneNumber: string) {
    // tslint:disable-next-line:no-console
    console.log(`Searching for contact in cache for ${phoneNumber}`);

    const { data: contacts }: AxiosResponse<Contact[]> =
      await getCachedContacts(config);
    return contacts.find((contact) =>
      contact.phoneNumbers.map(
        (contactPhoneNumber) => contactPhoneNumber.phoneNumber === phoneNumber
      )
    );
  }

  private async getContactByPhoneNumber(
    config: Config,
    phoneNumber: string
  ): Promise<Contact> {
    const field = "phone1";
    const { anonKey, spaceId } = parseConfig(config);
    const parsedPhoneNumber = parsePhoneNumber(phoneNumber);
    const contacts = await Promise.all([
      this.findPerson(config, field, phoneNumber),
      this.findPerson(config, field, `%2B${phoneNumber}`),
      this.findPerson(config, field, parsedPhoneNumber.localized),
      this.findPerson(
        config,
        field,
        normalizePhoneNumber(parsedPhoneNumber.localized)
      ),
      this.findPerson(config, field, parsedPhoneNumber.e164),
      this.findPerson(
        config,
        field,
        normalizePhoneNumber(parsedPhoneNumber.e164)
      ),
    ]);

    const contact = contacts.find(Boolean);

    if (!contact) {
      const cachedContact = await this.findContactInCache(config, phoneNumber);

      if (cachedContact) {
        // tslint:disable-next-line:no-console
        console.log(`Found contact in cache`);
        return cachedContact;
      }

      throw new ServerError(
        400,
        `Could not find pipeliner contact by phone number ${phoneNumber} for ${anonKey}`
      );
    }
    const response = convertToClinqContact(contact, spaceId);

    return response;
  }

  private async findPerson(
    config: Config,
    field: string,
    value: string
  ): Promise<IPipelinerContact | null> {
    const client = createClient(config);
    const response: AxiosResponse<IPipelinerContactsGet> = await client.get(
      `/Contacts?filter${encodeURI(`[${field}]`)}=${value}`
    );

    const contacts = response.data.data.find(Boolean);
    if (!contacts) {
      return null;
    }
    return contacts;
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
          offset: accumulated.length,
        },
      }
    );

    const contacts = data.data.map((contact) =>
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

async function fetchFirstClient(config: Config): Promise<IPipelinerClient> {
  const { anonKey } = parseConfig(config);

  const pipelinerClients = await fetchClients(config);

  const result = pipelinerClients.find(Boolean);
  if (result) {
    return result;
  }

  throw new ServerError(400, `Failed to fetch pipeliner users for ${anonKey}`);
}

async function fetchClients(config: Config): Promise<IPipelinerClient[]> {
  const { anonKey } = parseConfig(config);
  try {
    const client = createClient(config);
    const clientsResponse: AxiosResponse<IPipelinerClientsGet> =
      await client.get("Clients");

    return clientsResponse.data.data;
  } catch (e) {
    throw new ServerError(
      400,
      `Failed to fetch pipeliner users for ${anonKey}`
    );
  }
}

start(new MyAdapter());
