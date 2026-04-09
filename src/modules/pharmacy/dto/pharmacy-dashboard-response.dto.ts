export class DashboardKpiResponseDto {
  prescriptionsProcessed!: number;
  pendingOrders!: number;
  dispensedOrders!: number;
  revenue!: number;
  inventoryValue!: number;
  lowStockCount!: number;
  outOfStockCount!: number;
  nearExpiryCount!: number;
  expiredCount!: number;
}

export class DashboardChartPointDto {
  label!: string;
  start!: string;
  end!: string;
  value!: number;
}
