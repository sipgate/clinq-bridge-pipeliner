export interface IPipelinerAccount extends IPipelinerAccountTemplate {
  id: string;
}

export interface IPipelinerAccountTemplate {
  name: string;
  owner_id: string;
}
