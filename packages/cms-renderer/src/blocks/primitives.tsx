import {
  resolveCmsLinkHref,
  linkRel,
  linkTarget,
  type CmsButton,
  type CmsImage,
  type CmsLink,
} from "@mccoy/cms-schema";

export type LinkResolverPages = Array<{ id: string; slug: string }>;

export function CmsImageView({
  image,
  className,
}: {
  image: CmsImage;
  className?: string;
}) {
  const common = {
    src: image.src,
    className,
    loading: "lazy" as const,
    decoding: "async" as const,
    width: image.width,
    height: image.height,
  };
  if (image.decorative) {
    return <img {...common} alt="" role="presentation" />;
  }
  return <img {...common} alt={image.alt} />;
}

export function CmsButtonView({
  button,
  pages = [],
  className,
  onNavigate,
}: {
  button: CmsButton;
  pages?: LinkResolverPages;
  className?: string;
  onNavigate?: (link: CmsLink) => void;
}) {
  const href = resolveCmsLinkHref(button.link, pages) ?? "#";
  if (onNavigate) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onNavigate(button.link);
        }}
      >
        {button.label}
      </button>
    );
  }
  if (button.link.type === "none") {
    return <span className={className}>{button.label}</span>;
  }
  return (
    <a
      href={href}
      className={className}
      target={linkTarget(button.link)}
      rel={linkRel(button.link)}
    >
      {button.label}
    </a>
  );
}
