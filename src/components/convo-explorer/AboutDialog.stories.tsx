import { AboutDialog } from "./AboutDialog";

export default {
  title: "Components/AboutDialog",
  component: AboutDialog,
};

export const ManualTrigger = () => <AboutDialog />;

export const AutoOpen = () => <AboutDialog autoOpen />;