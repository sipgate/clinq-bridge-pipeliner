import {
    Adapter,
    Config,
    Contact, ContactTemplate,
    ContactUpdate,
    ServerError,
    start
} from "@clinq/bridge";
import {AxiosInstance, AxiosResponse} from "axios";
import {
    IPipelinerClient,
    IPipelinerClientsGet,
    IPipelinerContact,
    IPipelinerContactsGet,
    IPipelinerContactsPatch, IPipelinerResponse
} from "./models";
import {
    convertToClinqContact,
    convertToPipelinerContact,
    parseConfig
} from "./utils";
import {createClient} from "./utils/httpClient";

class MyAdapter implements Adapter {

    public async createContact(config: Config, contact: ContactTemplate) {

        const {spaceId, anonKey} = parseConfig(config);

        const pipelinerClient: IPipelinerClient = await fetchFirstClient(config);

        try {
            const client = await createClient(config);

            const pipelinerContact = {
                ...convertToPipelinerContact(contact),
                owner_id: pipelinerClient.id
            };

            const contactsPostResponse: AxiosResponse<IPipelinerContact> = await client.post("Contacts", pipelinerContact);

            return convertToClinqContact(contactsPostResponse.data, spaceId);
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.error(`Could not create contact ${contact.email} for ${anonKey}`);
            throw new ServerError(400, "Could not fetch contacts");
        }
    }

    public async getContacts(config: Config): Promise<Contact[]> {
        const {spaceId, anonKey} = parseConfig(config);
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
        const {anonKey, spaceId} = parseConfig(config);

        try {
            const client = await createClient(config);

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

    public async deleteContact(config: Config, id: string) {

        const {anonKey} = parseConfig(config);

        try {
            const client = await createClient(config);

            const response: AxiosResponse<IPipelinerResponse> = await client.delete(`Contacts/${id}`);

            if ((response.status >= 300) || (!response.data.success)) {
                return;
            }

        } catch (error) {
            // tslint:disable-next-line:no-console
            console.error(`Could not delete contact ${id} for ${anonKey}`);
            throw new ServerError(400, "Could not delete contact");
        }

        return;
    }

    private async fetchContacts(
        spaceId: string,
        client: AxiosInstance,
        accumulated: Contact[] = []
    ): Promise<Contact[]> {
        const {data}: AxiosResponse<IPipelinerContactsGet> = await client.get(
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

async function fetchFirstClient(config: Config): Promise<IPipelinerClient> {
    const {anonKey} = parseConfig(config);
    const client = await createClient(config);
    const clientsResponse: AxiosResponse<IPipelinerClientsGet> = await client.get("Clients");
    const pipelinerClient: IPipelinerClient | undefined = clientsResponse.data.data.find(Boolean);

    if (!pipelinerClient) {
        // tslint:disable-next-line:no-console
        console.error(`Failed to fetch pipeliner user for ${anonKey}`);
        throw new ServerError(400, "Failed to fetch pipeliner user");
    }

    return pipelinerClient;
}

start(new MyAdapter());
