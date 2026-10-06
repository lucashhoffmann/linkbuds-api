import { LinkPageLinkKind } from './enums/link-page-link-kind.enum';
import { LinkPageLinkPlacement } from './enums/link-page-link-placement.enum';

/** Same rule as the `link_page_links` CHECK constraint. */
export function isValidLinkConfiguration(link: {
  kind: LinkPageLinkKind;
  placement?: LinkPageLinkPlacement;
  url?: string | null;
  contactType?: unknown;
  contactValue?: string | null;
}) {
  const hasContact = Boolean(link.contactType) || Boolean(link.contactValue);

  if (link.kind === LinkPageLinkKind.LINK) {
    return Boolean(link.url) && !hasContact;
  }

  if (link.kind === LinkPageLinkKind.PREVIEW) {
    return (
      Boolean(link.url) &&
      !hasContact &&
      link.placement === LinkPageLinkPlacement.VERTICAL
    );
  }

  return (
    link.kind === LinkPageLinkKind.CONTACT &&
    !link.url &&
    Boolean(link.contactType) &&
    Boolean(link.contactValue)
  );
}
