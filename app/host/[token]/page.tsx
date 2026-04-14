import { SpectatorShell } from "@/components/spectator/spectator-shell";
import { isValidHostToken } from "@/lib/host/access";

type HostPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function HostPage({ params }: HostPageProps) {
  const { token } = await params;
  const expectedToken = process.env.HOST_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_HOST_ACCESS_TOKEN ?? "";
  const hostAccessEnabled = isValidHostToken({
    providedToken: token,
    expectedToken,
  });

  return <SpectatorShell hostAccessEnabled={hostAccessEnabled} />;
}
