export type Role = "student" | "admin";

export type EnrollmentSource = "payt" | "manual" | "subscription";

export type ContentBlockType = "text" | "html" | "embed" | "download";

export type BannerSlot = "header" | "sidebar" | "post-lesson";

export type MenuVisibility = "guest" | "student" | "admin";

export type NotificationType =
  | "news_post"
  | "comment_reply"
  | "new_lesson"
  | "course_complete"
  | "certificate_ready";

export type ReportTargetType =
  | "forum_post"
  | "forum_comment"
  | "news_comment"
  | "lesson_comment";

export type AuditAction =
  | "grant_access"
  | "revoke_access"
  | "ban_user"
  | "unban_user"
  | "delete_post"
  | "delete_comment"
  | "webhook_processed"
  | "webhook_failed";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: Role;
  banned: boolean;
  email_prefs: Record<NotificationType, boolean>;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  category_id: string;
  price: number;
  product_codes: string[];
  workload_hours: number;
  is_subscription_only: boolean;
  published: boolean;
  position: number;
  created_at: string;
  category?: Category;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  position: number;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  video_panda_id: string | null;
  duration_seconds: number;
  is_preview: boolean;
  position: number;
  content_blocks?: ContentBlock[];
  materials?: LessonMaterial[];
}

export interface ContentBlock {
  id: string;
  lesson_id: string;
  type: ContentBlockType;
  content: string;
  position: number;
}

export interface LessonMaterial {
  id: string;
  lesson_id: string;
  name: string;
  file_path: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  source: EnrollmentSource;
  granted_at: string;
  expires_at: string | null;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  last_position: number;
  updated_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  verify_hash: string;
  issued_at: string;
  pdf_path: string;
}

export interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  product_codes: string[];
  position_slot: BannerSlot;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

export interface MenuItem {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  target: "_self" | "_blank";
  visible_to: MenuVisibility;
  position: number;
  parent_id: string | null;
  children?: MenuItem[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface ShowcaseCourse {
  course_id: string;
  sales_video_panda_id: string | null;
  position: number;
  active: boolean;
  course?: Course;
}
