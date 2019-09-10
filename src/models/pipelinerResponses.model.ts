import { INoteTemplate } from "./note.model";
import { IPipelinerClient, IPipelinerContact } from "./pipelinerContact.model";

export interface IPipelinerResponse {
  success: boolean;
}

export interface IPipelinerContactsGet extends IPipelinerResponse {
  data: IPipelinerContact[];
  total: number;
}

export interface IPipelinerContactsPatch extends IPipelinerResponse {
  data: IPipelinerContact;
}

export interface IPipelinerClientsGet extends IPipelinerResponse {
  data: IPipelinerClient[];
}

export interface IPipelinerNotePost extends IPipelinerResponse {
  data: INoteTemplate;
}
