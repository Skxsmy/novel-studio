export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "INVALID_DATA"
      | "PATH_ESCAPE",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
