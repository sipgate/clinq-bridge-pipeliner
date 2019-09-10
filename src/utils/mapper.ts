import {
  Contact, ContactTemplate,
  ContactUpdate,
  PhoneNumber,
  PhoneNumberLabel
} from "@clinq/bridge";
import { IPipelinerContact, IPipelinerContactTemplate } from "../models";

export const convertToPipelinerContact = (
  contact: ContactUpdate | ContactTemplate
): IPipelinerContactTemplate => {
  const phone = contact.phoneNumbers
    .filter(phoneNumber => phoneNumber.label === PhoneNumberLabel.WORK)
    .map(phoneNumber => phoneNumber.phoneNumber)
    .find(Boolean);

  return {
    email1: contact.email ? contact.email : null,
    first_name: contact.firstName ? contact.firstName : null,
    last_name: contact.lastName ? contact.lastName : null,
    phone1: phone ? phone : null
  };
};

export const convertToClinqContact = (
  contact: IPipelinerContact,
  spaceId: string
): Contact => {
  const phoneNumbers: PhoneNumber[] = [];

  if (contact.phone1 && contact.phone1 !== "") {
    phoneNumbers.push({
      label: PhoneNumberLabel.WORK,
      phoneNumber: contact.phone1
    });
  }

  const contactUrl = `https://crm.pipelinersales.com/space/${spaceId}/contacts/${contact.id}/detail`;

  return {
    id: String(contact.id),
    avatarUrl: null,
    contactUrl,
    name: null,
    firstName: contact.first_name ? contact.first_name : null,
    lastName: contact.last_name ? contact.last_name : null,
    email: contact.email1 ? contact.email1 : null,
    organization: null,
    phoneNumbers
  };
};
