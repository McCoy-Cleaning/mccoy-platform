type AssetPointer = {
  url: string;
  original_filename?: string;
};

const modules = import.meta.glob("../assets/partner-docx/*.asset.json", {
  eager: true,
  import: "default",
}) as Record<string, AssetPointer>;

function formatPartnerName(fileName: string) {
  return fileName
    .replace(/\.(png|jpe?g|webp|svg)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const partners: { name: string; src: string }[] = Object.values(modules)
  .map((asset) => ({
    name: formatPartnerName(asset.original_filename ?? "Partner logo"),
    src: asset.url,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));