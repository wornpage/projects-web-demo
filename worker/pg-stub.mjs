// Bundler stand-in for the "pg" driver. The Workers build never selects
// Postgres storage (state lives in a Durable Object), but state-storage.js
// carries a lazy require("pg") the bundler still has to resolve.
export class Pool {
  constructor() {
    throw new Error("Postgres storage is not available in the Workers runtime.");
  }
}

export default { Pool };
