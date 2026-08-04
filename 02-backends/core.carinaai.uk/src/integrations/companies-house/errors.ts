export class CompaniesHouseAuthError extends Error {
  constructor(message = 'Companies House API key missing or rejected') {
    super(message);
    this.name = 'CompaniesHouseAuthError';
  }
}

export class CompaniesHouseRateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'CompaniesHouseRateLimitError';
  }
}

export class CompaniesHouseNotFoundError extends Error {
  constructor(message = 'Companies House resource not found') {
    super(message);
    this.name = 'CompaniesHouseNotFoundError';
  }
}

export class CompaniesHouseApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'CompaniesHouseApiError';
  }
}
