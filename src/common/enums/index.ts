// src/common/enums/index.ts

export enum Role {
  ADMIN = 'admin',
  SALE = 'sale',
  WAREHOUSE = 'warehouse',
  ACCOUNTANT = 'accountant',
}

export enum PartnerType {
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier',
}

export enum PartnerStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

export enum OrderStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}
