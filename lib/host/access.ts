type HostTokenInput = {
  providedToken: string | null | undefined;
  expectedToken: string | null | undefined;
};

export function isValidHostToken(input: HostTokenInput): boolean {
  const providedToken = input.providedToken?.trim();
  const expectedToken = input.expectedToken?.trim();

  return Boolean(providedToken && expectedToken && providedToken === expectedToken);
}

export function canUseHostControls(input: { hostAccessEnabled: boolean }): boolean {
  return input.hostAccessEnabled;
}
