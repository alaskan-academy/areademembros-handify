export const VALID_ICONS = [
  "LayoutDashboard", "BookOpen", "User", "Bell", "Users", "Home",
  "ShoppingBag", "Star", "Heart", "Globe", "MessageSquare", "Video",
  "Award", "Settings", "HelpCircle", "GraduationCap", "Layers",
  "Zap", "Gift", "Map",
] as const;

export type ValidIcon = (typeof VALID_ICONS)[number];
