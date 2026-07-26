export class FormSubmitError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "config" | "provider" | "rate_limit",
  ) {
    super(message);
    this.name = "FormSubmitError";
  }
}
