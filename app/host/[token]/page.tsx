import { HostShell } from "@/components/host/host-shell";
import { isValidHostToken } from "@/lib/host/access";

type Props = { params: Promise<{ token: string }> };

export default async function HostPage({ params }: Props) {
  const { token } = await params;
  const expectedToken = process.env.HOST_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_HOST_ACCESS_TOKEN ?? "";
  const hostAccessEnabled = isValidHostToken({ providedToken: token, expectedToken });
  return <HostShell hostAccessEnabled={hostAccessEnabled} />;
}
