import { IPipelinerContact } from "./pipelinerContact.model";

export interface IPipelinerContactsGet {
  success: boolean;
  data: IPipelinerContact[];
  total: number;
}

export interface IPipelinerContactsPatch {
  success: boolean;
  data: IPipelinerContact;
}
