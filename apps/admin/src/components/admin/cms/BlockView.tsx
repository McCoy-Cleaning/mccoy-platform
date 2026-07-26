import { RegisteredBlockView } from "@mccoy/cms-renderer";
import type { Block } from "@mccoy/cms-schema";

export function BlockView({ block, adminMode = true }: { block: Block; adminMode?: boolean }) {
  return <RegisteredBlockView block={block} adminMode={adminMode} />;
}

export function BlocksView({ blocks, adminMode = true }: { blocks: Block[]; adminMode?: boolean }) {
  // Width/padding live in cms-renderer SectionShell so preview matches storefront.
  return (
    <>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} adminMode={adminMode} />
      ))}
    </>
  );
}
