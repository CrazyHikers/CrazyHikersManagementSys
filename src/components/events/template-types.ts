// Props passed to a template's bespoke landing component when the public
// activity detail route hands rendering over to it. Kept loose because
// the activity payload shape is large and lives downstream.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LandingActivity = any;

export type LandingProps = {
  activity: LandingActivity;
  locale: string;
  isOpen: boolean;
  isFull: boolean;
};
