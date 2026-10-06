export enum LinkPageType {
  AGENCY = 'AGENCY',
  CLIENT = 'CLIENT',
  /** Sub-page of a bio page for one social post: /p/:parent/:post. */
  POST = 'POST',
  /** Sub-page of a bio page with a form: /p/:parent/:form. */
  FORM = 'FORM',
}
