export type VehicleCategory = 'private' | 'transport';
export type ImageFitMode = 'contain' | 'cover';

export interface VehicleInfo {
  declarationNumber: string;
  declarationDate: string;
  customsPort: string;
  make: string;
  model: string;
  bodyStyle: string;
  trim: string;
  year: string;
  vin: string;
  engineNumber: string;
  color: string;
  cylinders: string;
  fuelType: string;
}

export interface PersonInfo {
  fullName: string;
  nationalId: string;
  idType: string;
  bloodType: string;
  birthDate: string;
  birthPlace: string;
  issuePlace: string;
  nationality: string;
  cardAddress: string;
  // Manual fields
  mobile: string;
  currentResidence: string;
  idCardImage: string;
}

export interface WitnessInfo extends PersonInfo {
  id: string;
  relation: string;
}

export interface RegistrationRecord {
  id: string;
  serialNumber: string;
  formNumber: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
  retainUntil?: string;
  category: VehicleCategory;
  plateNumber: string;
  plateRegion: string;
  plateImage: string;
  plateImageFit?: ImageFitMode;
  ownerPhoto: string;
  ownerPhotoFit?: ImageFitMode;
  customsImage: string;
  vehicle: VehicleInfo;
  owner: PersonInfo;
  witnesses: WitnessInfo[];
}

export function createEmptyVehicle(): VehicleInfo {
  return {
    declarationNumber: '',
    declarationDate: '',
    customsPort: '',
    make: '',
    model: '',
    bodyStyle: '',
    trim: '',
    year: '',
    vin: '',
    engineNumber: '',
    color: '',
    cylinders: '',
    fuelType: '',
  };
}

export function createEmptyPerson(): PersonInfo {
  return {
    fullName: '',
    nationalId: '',
    idType: 'بطاقة شخصية',
    bloodType: '',
    birthDate: '',
    birthPlace: '',
    issuePlace: '',
    nationality: '',
    cardAddress: '',
    mobile: '',
    currentResidence: '',
    idCardImage: '',
  };
}

export function createEmptyWitness(index: number): WitnessInfo {
  return {
    ...createEmptyPerson(),
    id: `witness-${Date.now()}-${index}`,
    relation: '',
  };
}
