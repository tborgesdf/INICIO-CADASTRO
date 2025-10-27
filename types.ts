
export interface SocialMedia {
  instagram?: string;
  linkedin?: string;
  x?: string;
  facebook?: string;
  tiktok?: string;
  snapchat?: string;
  youtube?: string;
  pinterest?: string;
  other?: string;
}

export interface UserData {
  cpf: string;
  phone: string;
  email: string;
  socialMedia: SocialMedia;
  location: GeolocationCoordinates | null;
  visaType: 'renewal' | 'first_visa' | null;
  countries: string[];
}

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  sources?: GroundingSource[];
}

export interface GroundingSource {
    uri: string;
    title: string;
}