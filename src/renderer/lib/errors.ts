export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const message = error.message.replace(
      /^Error invoking remote method '[^']+': (?:Error: )?/,
      '',
    );

    if (message) {
      return message;
    }
  }

  return fallback;
}
