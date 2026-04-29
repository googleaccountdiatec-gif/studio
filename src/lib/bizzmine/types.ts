/** Raw shape returned by BizzMine `/collection/{code}/instances`. */
export type RawInstance = Record<string, unknown>;

/** Combobox / RadioGroup field shape. */
export interface ComboboxValue {
  value: number;
  text: string;
}

/** OrganizationChartUnitSelector field shape. */
export interface OrgChartEntry {
  /** 1 = individual user, 2 = group/team, 3-5 not yet observed. */
  type: number;
  id: number;
  value: string;
}

/** Sub-collection (GridRecord) wrapper for embedded linked records. */
export interface SubCollectionEntry {
  CrossLinkInstancesID?: number;
  DataDesignCrossID?: number;
  OriginalChildInstancesID?: number;
  [field: string]: unknown;
}

/** Open-task shape returned by `/collection/{code}/tasks`. */
export interface OpenTask {
  ID: number;
  CollectionsID: number;
  InstancesID: number;
  VersionsID: number;
  StepVersionsID: number;
  StepName: string;
  Subject: string;
  Body: string;
  DueDate: string;
  Assignees: Array<{ ObjectID: number; ObjectType: number; Name: string }>;
}

/** Result of harvesting users from instance data. */
export interface HarvestedUser {
  /** 1 = user, 2 = group. */
  type: number;
  name: string;
  /** ISO timestamp when this id was last observed in fresh API data. */
  lastSeenAt: string;
  /** Collection codes where this id appeared. */
  sourceCollections: string[];
}

export type UsersById = Record<number, HarvestedUser>;

/** AD/info response (used by health check). */
export interface AdInfoResponse {
  ADDomain: string;
  ValidLicense: boolean;
  AADClientID: string;
  AADClientSecret: string;
  ADMode: number;
  Version: string;
}
