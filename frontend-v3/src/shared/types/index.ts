export interface Vehicle {
  id?: string;
  number: string;
  vehicle_type?: string;
  status?: string;
  license_plate?: string;
  trips?: number;
}

export interface Driver {
  driver_name: string;
  last_report?: string;
  total_reports?: number;
  current_vehicle?: string;
}

export interface Trip {
  id?: string;
  loading_date?: string;
  loading_time?: string;
  unloading_date?: string;
  unloading_time?: string;
  loading_point?: string;
  unloading_point?: string;
  route_name?: string;
  route?: string;
  trip_amount?: number;
  driver_rate?: number;
  penalty_amount?: number;
  distance_km?: number;
}
