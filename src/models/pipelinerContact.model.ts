export interface IPipelinerContact extends IPipelinerContactTemplate {
  id: string;
}

export interface IPipelinerContactTemplate {
  email1: string | null;
  first_name: string | null;
  last_name: string | null;
  phone1: string | null;
}
