export interface AlertResponse {
  id: string;
  houseId: string;
  deviceId: string;
  deviceName: string;
  title: string;
  message: string;
  type: 'critical' | 'warning';
  resolved: boolean;
  createdAt: Date;
}
