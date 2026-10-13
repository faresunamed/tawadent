export type DentistStatus = "pending" | "approved" | "suspended" | "rejected";
export type RequestStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";

export type Clinic = {
  id: string;
  clinic_name: string;
  dentist_name: string;
  zone_id: string;
  available_until: string;
};

export type ClinicDetails = {
  clinic_name: string;
  dentist_name: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
};

export type PatientRequest = {
  id: string;
  status: RequestStatus;
  zone_id: string;
  clinic_name: string;
  created_at: string;
  expires_at: string;
  seconds_left: number;
  clinic?: ClinicDetails;
};

export type DentistRow = {
  id: string;
  full_name: string;
  clinic_name: string;
  address: string;
  zone_id: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  order_number: string;
  status: DentistStatus;
  status_note: string | null;
  available_until: string | null;
};

export type InboxRequest = {
  id: string;
  status: RequestStatus;
  patient_first_name: string;
  patient_phone: string | null;
  zone_id: string;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  seconds_left: number;
};

export type AdminDentist = DentistRow & { email: string; created_at: string };

export type AdminOverview = {
  dentists: Partial<Record<DentistStatus, number>>;
  available_now: number;
  requests_24h: Partial<Record<RequestStatus, number>>;
};

export type AdminRecentRequest = {
  id: string;
  created_at: string;
  status: RequestStatus;
  clinic_name: string;
  zone_id: string;
  response_seconds: number | null;
};
