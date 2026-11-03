import { useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/nft/detail-page";

export function NftRoute() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  return <DetailPage slug={slug} />;
}
