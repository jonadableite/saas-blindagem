// src/db/schema.ts
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod";

// ================================
// ENUMS
// ================================

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "admin",
  "superadmin",
]);

// ================================
// TABELAS
// ================================

export const usersTables = pgTable("users_tables", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").default("FREE").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { mode: "date" }),

  // Configurações do usuário
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  dailyMessageLimit: integer("daily_message_limit").default(1000).notNull(),
  monthlyMessageLimit: integer("monthly_message_limit")
    .default(10000)
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),

  // limite de instâncias
  instanceLimits: integer("instance_limits").default(2).notNull(),
  instanceTotal: integer("instance_total").default(0).notNull(),

  // Configurações avançadas
  settings: jsonb("settings").default({}).notNull(),

  // Auditoria
  lastLoginAt: timestamp("last_login_at"),
  deletedAt: timestamp("deleted_at"),
});

export const instancesTables = pgTable(
  "instances_tables",
  {
    instanceId: text("instance_id").primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTables.id, { onDelete: "cascade" }),
    instanceName: text("instance_name").notNull(),
    integration: text("integration").notNull().default("WHATSAPP-BAILEYS"),
    status: text("status").default("disconnected").notNull(),
    ownerJid: text("owner_jid"),
    profileName: text("profile_name"),
    profilePicUrl: text("profile_pic_url"),
    qrcode: boolean("qrcode").default(true).notNull(),
    phoneNumber: text("phone_number"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Estatísticas da instância (Calculadas ou atualizadas por triggers/workers)
    totalMessagesSent: integer("total_messages_sent").default(0).notNull(),
    typeMessagesSent: jsonb("type_messages_sent").default({}).notNull(),
    monthlyMessagesSent: integer("monthly_messages_sent").default(0).notNull(),
    lastMessageSentAt: timestamp("last_message_sent_at"),
    lastResetAt: timestamp("last_reset_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Status de conexão
    isConnected: boolean("is_connected").default(false).notNull(),
    lastConnectedAt: timestamp("last_connected_at"),
    disconnectedAt: timestamp("disconnected_at"),

    // Configurações da instância
    webhookUrl: text("webhook_url"),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),

    // Auditoria
    deletedAt: timestamp("deleted_at"), // Soft delete
  },
  (instances) => ({
    userIdIdx: index("instances_user_id_idx").on(instances.userId),
    statusIdx: index("instances_status_idx").on(instances.status),
    activeIdx: index("instances_active_idx").on(instances.isActive),
    phoneIdx: index("instances_phone_idx").on(instances.phoneNumber),
    deletedIdx: index("instances_deleted_idx").on(instances.deletedAt),
  }),
);

export const sessionsTables = pgTable("sessions_tables", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by").references(() => usersTables.id, {
    onDelete: "set null",
  }),
});

export const accountsTables = pgTable("accounts_tables", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verificationsTables = pgTable("verifications_tables", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

// ================================
// TABELAS DE AQUECIMENTO (WARMUP)
// ================================

// Warmup Configs Table - Enhanced with advanced features
export const warmupConfigsTables = pgTable("warmup_configs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id),
  name: text("name").notNull(),
  description: text("description"),

  // Basic Configuration
  maxConcurrentInstances: integer("max_concurrent_instances")
    .notNull()
    .default(1),
  dailyMessageLimit: integer("daily_message_limit").notNull().default(50),
  monthlyMessageLimit: integer("monthly_message_limit").notNull().default(1000),

  // Message Intervals (in seconds)
  messageIntervalMin: integer("message_interval_min").notNull().default(10),
  messageIntervalMax: integer("message_interval_max").notNull().default(300),

  // Message Type Chances (0.0 to 1.0)
  textChance: real("text_chance").notNull().default(0.35),
  audioChance: real("audio_chance").notNull().default(0.25),
  reactionChance: real("reaction_chance").notNull().default(0.4),
  stickerChance: real("sticker_chance").notNull().default(0.15),
  imageChance: real("image_chance").notNull().default(0.08),
  videoChance: real("video_chance").notNull().default(0.05),
  documentChance: real("document_chance").notNull().default(0.03),
  locationChance: real("location_chance").notNull().default(0.02),
  contactChance: real("contact_chance").notNull().default(0.02),
  pollChance: real("poll_chance").notNull().default(0.02),

  // Advanced Features
  enableReactions: boolean("enable_reactions").notNull().default(true),
  enableReplies: boolean("enable_replies").notNull().default(true),
  enableMediaMessages: boolean("enable_media_messages").notNull().default(true),
  enableGroupMessages: boolean("enable_group_messages").notNull().default(true),

  // Group Configuration
  groupChance: real("group_chance").notNull().default(0.3),
  groupId: text("group_id").default("120363419940617369@g.us"),
  groupJoinChance: real("group_join_chance").notNull().default(0.02),
  groupLeaveChance: real("group_leave_chance").notNull().default(0.01),
  groupInviteChance: real("group_invite_chance").notNull().default(0.01),

  // External Numbers
  useExternalNumbers: boolean("use_external_numbers").notNull().default(true),
  externalNumbersChance: real("external_numbers_chance").notNull().default(0.4),
  externalNumbers: jsonb("external_numbers").$type<string[]>().default([]),

  // Target Configuration
  targetGroups: jsonb("target_groups").$type<string[]>().default([]),
  targetNumbers: jsonb("target_numbers").$type<string[]>().default([]),

  // Human Behavior Simulation
  typingSimulation: boolean("typing_simulation").notNull().default(true),
  onlineStatusSimulation: boolean("online_status_simulation")
    .notNull()
    .default(true),
  readReceiptSimulation: boolean("read_receipt_simulation")
    .notNull()
    .default(true),

  // Time-based Optimization
  activeHoursStart: integer("active_hours_start").notNull().default(8),
  activeHoursEnd: integer("active_hours_end").notNull().default(22),
  weekendBehavior: text("weekend_behavior", {
    enum: ["normal", "reduced", "disabled"],
  })
    .notNull()
    .default("normal"),

  // Auto-reply System
  autoReplyChance: real("auto_reply_chance").notNull().default(0.3),
  replyDelayMin: integer("reply_delay_min").notNull().default(2000),
  replyDelayMax: integer("reply_delay_max").notNull().default(10000),

  // Status and Profile Updates
  statusUpdateChance: real("status_update_chance").notNull().default(0.1),
  statusTexts: jsonb("status_texts").$type<string[]>().default([]),
  profileUpdateChance: real("profile_update_chance").notNull().default(0.05),
  profileNames: jsonb("profile_names").$type<string[]>().default([]),
  profileBios: jsonb("profile_bios").$type<string[]>().default([]),

  // Media Behavior
  mediaDownloadChance: real("media_download_chance").notNull().default(0.5),
  mediaForwardChance: real("media_forward_chance").notNull().default(0.2),

  // Security and Anti-Detection
  antiDetectionMode: boolean("anti_detection_mode").notNull().default(false),
  randomDeviceInfo: boolean("random_device_info").notNull().default(false),
  messageQuality: text("message_quality", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),

  // Engagement Optimization
  engagementOptimization: boolean("engagement_optimization")
    .notNull()
    .default(true),

  // Error Handling
  retryOnError: boolean("retry_on_error").notNull().default(true),
  maxRetries: integer("max_retries").notNull().default(3),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Warmup Contents Table - Enhanced with all message types
export const warmupContentsTables = pgTable("warmup_contents", {
  id: text("id").primaryKey(),
  configId: text("config_id")
    .notNull()
    .references(() => warmupConfigsTables.id),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id),

  // Content Type
  type: text("type", {
    enum: [
      "text",
      "image",
      "video",
      "audio",
      "sticker",
      "document",
      "location",
      "contact",
      "poll",
      "button",
      "list",
      "reaction",
    ],
  }).notNull(),

  // Content Data (JSONB for flexibility)
  content: jsonb("content").notNull().$type<{
    // Text content
    text?: string;

    // Media content
    url?: string;
    base64?: string;
    caption?: string;
    fileName?: string;
    mimetype?: string;

    // Sticker content
    stickerUrl?: string;
    stickerBase64?: string;

    // Document content
    documentUrl?: string;
    documentBase64?: string;
    documentName?: string;
    documentType?: string;

    // Location content
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;

    // Contact content
    contactName?: string;
    contactNumber?: string;
    contactEmail?: string;

    // Poll content
    question?: string;
    options?: string[];

    // Button content
    buttonText?: string;
    buttonUrl?: string;

    // List content
    listTitle?: string;
    listItems?: Array<{ title: string; description?: string; url?: string }>;

    // Reaction content
    emojis?: string[];

    // Media metadata
    width?: number;
    height?: number;
    duration?: number;
    size?: number;
  }>(),

  // Usage tracking
  useCount: integer("use_count").notNull().default(0),
  lastUsed: timestamp("last_used"),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Warmup Stats Table - Enhanced with engagement metrics
export const warmupStatsTables = pgTable("warmup_stats", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id")
    .notNull()
    .references(() => instancesTables.instanceId),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id),
  configId: text("config_id")
    .notNull()
    .references(() => warmupConfigsTables.id),

  // Date tracking
  date: date("date").notNull(),

  // Message counts by type
  textCount: integer("text_count").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
  videoCount: integer("video_count").notNull().default(0),
  audioCount: integer("audio_count").notNull().default(0),
  stickerCount: integer("sticker_count").notNull().default(0),
  documentCount: integer("document_count").notNull().default(0),
  locationCount: integer("location_count").notNull().default(0),
  contactCount: integer("contact_count").notNull().default(0),
  pollCount: integer("poll_count").notNull().default(0),
  buttonCount: integer("button_count").notNull().default(0),
  listCount: integer("list_count").notNull().default(0),
  reactionCount: integer("reaction_count").notNull().default(0),

  // Engagement metrics
  engagementScore: real("engagement_score").notNull().default(0),
  responseRate: real("response_rate").notNull().default(0),
  averageResponseTime: integer("average_response_time").notNull().default(0),
  conversationDepth: integer("conversation_depth").notNull().default(0),
  groupParticipation: real("group_participation").notNull().default(0),

  // Message statistics
  messagesSent: integer("messages_sent").notNull().default(0),
  messagesReceived: integer("messages_received").notNull().default(0),
  messagesDelivered: integer("messages_delivered").notNull().default(0),
  messagesRead: integer("messages_read").notNull().default(0),

  // Error tracking
  errorCount: integer("error_count").notNull().default(0),
  retryCount: integer("retry_count").notNull().default(0),

  // Daily and all-time totals
  totalDaily: integer("total_daily").notNull().default(0),
  totalAllTime: integer("total_all_time").notNull().default(0),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Media Stats Table - Enhanced for all media types
export const mediaStatsTables = pgTable("media_stats", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id")
    .notNull()
    .references(() => instancesTables.instanceId),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id),
  date: date("date").notNull(),
  isReceived: boolean("is_received").notNull().default(false),

  // Media type counts
  textCount: integer("text_count").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
  videoCount: integer("video_count").notNull().default(0),
  audioCount: integer("audio_count").notNull().default(0),
  stickerCount: integer("sticker_count").notNull().default(0),
  documentCount: integer("document_count").notNull().default(0),
  locationCount: integer("location_count").notNull().default(0),
  contactCount: integer("contact_count").notNull().default(0),
  pollCount: integer("poll_count").notNull().default(0),
  buttonCount: integer("button_count").notNull().default(0),
  listCount: integer("list_count").notNull().default(0),
  reactionCount: integer("reaction_count").notNull().default(0),

  // Totals
  totalDaily: integer("total_daily").notNull().default(0),
  totalAllTime: integer("total_all_time").notNull().default(0),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Warmup Logs Table - Enhanced with detailed action tracking
export const warmupLogsTables = pgTable("warmup_logs", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id")
    .notNull()
    .references(() => instancesTables.instanceId),
  userId: text("user_id")
    .notNull()
    .references(() => usersTables.id),
  configId: text("config_id").references(() => warmupConfigsTables.id),

  // Action details
  action: text("action").notNull(),
  messageType: text("message_type"),
  target: text("target"),
  success: boolean("success").notNull(),

  // Additional details
  details: jsonb("details").$type<{
    messageId?: string;
    responseTime?: number;
    errorCode?: string;
    retryAttempt?: number;
    engagementScore?: number;
    conversationDepth?: number;
    groupId?: string;
    isGroupMessage?: boolean;
    isExternalNumber?: boolean;
    typingDuration?: number;
    onlineStatus?: string;
    readReceiptSent?: boolean;
    mediaInfo?: {
      size?: number;
      duration?: number;
      dimensions?: { width: number; height: number };
    };
  }>(),

  // Error information
  errorMessage: text("error_message"),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ================================
// CONSTANTES E CONFIGURAÇÕES
// ================================

export const DEFAULT_EXTERNAL_NUMBERS = [
  "5511999999999",
  "5511888888888",
  "5511777777777",
  "5511666666666",
  "5511555555555",
  "5511444444444",
];

export const DEFAULT_EXTERNAL_NUMBERS_CHANCE = 20; // 20%
export const DEFAULT_GROUP_CHANCE = 30; // 30%
export const DEFAULT_GROUP_ID = "120363025123456789@g.us";

export const PLAN_LIMITS = {
  FREE: { maxInstances: 2, dailyMessages: 100, monthlyMessages: 1000 },
  BASIC: { maxInstances: 10, dailyMessages: 500, monthlyMessages: 5000 },
  PRO: { maxInstances: 50, dailyMessages: 2000, monthlyMessages: 20000 },
  ENTERPRISE: {
    maxInstances: 200,
    dailyMessages: 10000,
    monthlyMessages: 100000,
  },
};

// ================================
// RELAÇÕES
// ================================

export const usersRelations = relations(usersTables, ({ many }) => ({
  instances: many(instancesTables),
  sessions: many(sessionsTables),
  accounts: many(accountsTables),
  impersonatedSessions: many(sessionsTables, {
    relationName: "impersonatedSession",
  }),
  warmupConfigs: many(warmupConfigsTables),
  warmupContents: many(warmupContentsTables),
  warmupStats: many(warmupStatsTables),
  mediaStats: many(mediaStatsTables),
  warmupLogs: many(warmupLogsTables),
}));

export const instancesRelations = relations(
  instancesTables,
  ({ one, many }) => ({
    user: one(usersTables, {
      fields: [instancesTables.userId],
      references: [usersTables.id],
    }),
    warmupStats: many(warmupStatsTables),
    mediaStats: many(mediaStatsTables),
    warmupLogs: many(warmupLogsTables),
  }),
);

export const sessionsRelations = relations(sessionsTables, ({ one }) => ({
  user: one(usersTables, {
    fields: [sessionsTables.userId],
    references: [usersTables.id],
  }),
  impersonatedByUser: one(usersTables, {
    fields: [sessionsTables.impersonatedBy],
    references: [usersTables.id],
    relationName: "impersonatedSession",
  }),
}));

export const accountsRelations = relations(accountsTables, ({ one }) => ({
  user: one(usersTables, {
    fields: [accountsTables.userId],
    references: [usersTables.id],
  }),
}));

export const warmupConfigsRelations = relations(
  warmupConfigsTables,
  ({ one, many }) => ({
    user: one(usersTables, {
      fields: [warmupConfigsTables.userId],
      references: [usersTables.id],
    }),
    contents: many(warmupContentsTables),
    stats: many(warmupStatsTables),
    logs: many(warmupLogsTables),
  }),
);

export const warmupContentsRelations = relations(
  warmupContentsTables,
  ({ one }) => ({
    config: one(warmupConfigsTables, {
      fields: [warmupContentsTables.configId],
      references: [warmupConfigsTables.id],
    }),
    user: one(usersTables, {
      fields: [warmupContentsTables.userId],
      references: [usersTables.id],
    }),
  }),
);

export const warmupStatsRelations = relations(warmupStatsTables, ({ one }) => ({
  instance: one(instancesTables, {
    fields: [warmupStatsTables.instanceId],
    references: [instancesTables.instanceId],
  }),
  user: one(usersTables, {
    fields: [warmupStatsTables.userId],
    references: [usersTables.id],
  }),
  config: one(warmupConfigsTables, {
    fields: [warmupStatsTables.configId],
    references: [warmupConfigsTables.id],
  }),
}));

export const mediaStatsRelations = relations(mediaStatsTables, ({ one }) => ({
  instance: one(instancesTables, {
    fields: [mediaStatsTables.instanceId],
    references: [instancesTables.instanceId],
  }),
  user: one(usersTables, {
    fields: [mediaStatsTables.userId],
    references: [usersTables.id],
  }),
}));

export const warmupLogsRelations = relations(warmupLogsTables, ({ one }) => ({
  instance: one(instancesTables, {
    fields: [warmupLogsTables.instanceId],
    references: [instancesTables.instanceId],
  }),
  user: one(usersTables, {
    fields: [warmupLogsTables.userId],
    references: [usersTables.id],
  }),
  config: one(warmupConfigsTables, {
    fields: [warmupLogsTables.configId],
    references: [warmupConfigsTables.id],
  }),
}));

// ================================
// SCHEMAS DE VALIDAÇÃO ZOD
// ================================

export const CreateInstanceSchema = z.object({
  instanceName: z.string().min(1, "Nome da instância é obrigatório").max(50),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  webhookEnabled: z.boolean(),
});

// Schemas de validação para Warmup - Enhanced
export const CreateWarmupConfigSchema = z.object({
  name: z.string().min(1, "Nome da configuração é obrigatório").max(100),
  description: z.string().optional(),

  // Basic Configuration
  maxConcurrentInstances: z.number().min(1).max(200),
  dailyMessageLimit: z.number().min(1).max(1000),
  monthlyMessageLimit: z.number().min(1).max(10000),
  messageIntervalMin: z.number().min(10).max(300),
  messageIntervalMax: z.number().min(10).max(600),

  // Message Type Chances (0.0 to 1.0)
  textChance: z.number().min(0).max(1).default(0.35),
  audioChance: z.number().min(0).max(1).default(0.25),
  reactionChance: z.number().min(0).max(1).default(0.4),
  stickerChance: z.number().min(0).max(1).default(0.15),
  imageChance: z.number().min(0).max(1).default(0.08),
  videoChance: z.number().min(0).max(1).default(0.05),
  documentChance: z.number().min(0).max(1).default(0.03),
  locationChance: z.number().min(0).max(1).default(0.02),
  contactChance: z.number().min(0).max(1).default(0.02),
  pollChance: z.number().min(0).max(1).default(0.02),

  // Advanced Features
  enableReactions: z.boolean().default(true),
  enableReplies: z.boolean().default(true),
  enableMediaMessages: z.boolean().default(true),
  enableGroupMessages: z.boolean().default(true),

  // Group Configuration
  groupChance: z.number().min(0).max(1).default(0.3),
  groupId: z.string().default("120363419940617369@g.us"),
  groupJoinChance: z.number().min(0).max(1).default(0.02),
  groupLeaveChance: z.number().min(0).max(1).default(0.01),
  groupInviteChance: z.number().min(0).max(1).default(0.01),

  // External Numbers
  useExternalNumbers: z.boolean().default(true),
  externalNumbersChance: z.number().min(0).max(1).default(0.4),
  externalNumbers: z.array(z.string()).default([]),

  // Target Configuration
  targetGroups: z.array(z.string()).default([]),
  targetNumbers: z.array(z.string()).default([]),

  // Human Behavior Simulation
  typingSimulation: z.boolean().default(true),
  onlineStatusSimulation: z.boolean().default(true),
  readReceiptSimulation: z.boolean().default(true),

  // Time-based Optimization
  activeHoursStart: z.number().min(0).max(23).default(8),
  activeHoursEnd: z.number().min(0).max(23).default(22),
  weekendBehavior: z.enum(["normal", "reduced", "disabled"]).default("normal"),

  // Auto-reply System
  autoReplyChance: z.number().min(0).max(1).default(0.3),
  replyDelayMin: z.number().min(1000).max(30000).default(2000),
  replyDelayMax: z.number().min(1000).max(60000).default(10000),

  // Status and Profile Updates
  statusUpdateChance: z.number().min(0).max(1).default(0.1),
  statusTexts: z.array(z.string()).default([]),
  profileUpdateChance: z.number().min(0).max(1).default(0.05),
  profileNames: z.array(z.string()).default([]),
  profileBios: z.array(z.string()).default([]),

  // Media Behavior
  mediaDownloadChance: z.number().min(0).max(1).default(0.5),
  mediaForwardChance: z.number().min(0).max(1).default(0.2),

  // Security and Anti-Detection
  antiDetectionMode: z.boolean().default(false),
  randomDeviceInfo: z.boolean().default(false),
  messageQuality: z.enum(["low", "medium", "high"]).default("medium"),

  // Engagement Optimization
  engagementOptimization: z.boolean().default(true),

  // Error Handling
  retryOnError: z.boolean().default(true),
  maxRetries: z.number().min(1).max(10).default(3),
});

export const UpdateWarmupConfigSchema = CreateWarmupConfigSchema.partial();

export const WarmupContentSchema = z.object({
  type: z.enum([
    "text",
    "image",
    "video",
    "audio",
    "sticker",
    "document",
    "location",
    "contact",
    "poll",
    "button",
    "list",
    "reaction",
  ]),

  // Content data (flexible JSON structure)
  content: z.union([
    // Text content
    z.string().min(1, "Conteúdo é obrigatório"),

    // Media content
    z.object({
      url: z.string().url().optional(),
      base64: z.string().optional(),
      caption: z.string().optional(),
      fileName: z.string().optional(),
      mimetype: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      duration: z.number().optional(),
      size: z.number().optional(),
    }),

    // Sticker content
    z.object({
      stickerUrl: z.string().url().optional(),
      stickerBase64: z.string().optional(),
    }),

    // Document content
    z.object({
      documentUrl: z.string().url().optional(),
      documentBase64: z.string().optional(),
      documentName: z.string().optional(),
      documentType: z.string().optional(),
    }),

    // Location content
    z.object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
    }),

    // Contact content
    z.object({
      contactName: z.string(),
      contactNumber: z.string(),
      contactEmail: z.string().email().optional(),
    }),

    // Poll content
    z.object({
      question: z.string(),
      options: z.array(z.string()).min(2).max(4),
    }),

    // Button content
    z.object({
      buttonText: z.array(z.string()).optional(),
      buttonUrl: z.string().url().optional(),
    }),

    // List content
    z.object({
      listTitle: z.string(),
      listItems: z.array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          url: z.string().url().optional(),
        }),
      ),
    }),

    // Reaction content
    z.object({
      emojis: z.array(z.string()),
    }),
  ]),

  // Usage tracking
  usageWeight: z.number().min(1).max(10).default(5),
  maxUsagePerDay: z.number().min(1).max(100).default(10),

  // Metadata
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
});

export const StartWarmupSchema = z.object({
  configId: z.string().min(1, "ID da configuração é obrigatório"),
  instanceIds: z.array(z.string()).min(1, "Selecione pelo menos uma instância"),

  // Advanced options
  phoneInstances: z
    .array(
      z.object({
        instanceId: z.string(),
        phoneNumber: z.string(),
      }),
    )
    .optional(),

  // Content overrides
  contents: z
    .object({
      texts: z.array(z.string()).default([]),
      images: z.array(z.string()).default([]),
      audios: z.array(z.string()).default([]),
      videos: z.array(z.string()).default([]),
      stickers: z.array(z.string()).default([]),
      emojis: z.array(z.string()).default(["👍", "❤️", "😂", "😮", "🙏"]),
      documents: z
        .array(
          z.object({
            base64: z.string(),
            fileName: z.string(),
            mimetype: z.string(),
            caption: z.string().optional(),
          }),
        )
        .default([]),
      locations: z
        .array(
          z.object({
            latitude: z.number(),
            longitude: z.number(),
            name: z.string().optional(),
            address: z.string().optional(),
          }),
        )
        .default([]),
      contacts: z
        .array(
          z.object({
            name: z.string(),
            number: z.string(),
            email: z.string().email().optional(),
          }),
        )
        .default([]),
      polls: z
        .array(
          z.object({
            question: z.string(),
            options: z.array(z.string()).min(2).max(4),
          }),
        )
        .default([]),
    })
    .optional(),

  // Config overrides
  config: z
    .object({
      textChance: z.number().min(0).max(1).optional(),
      audioChance: z.number().min(0).max(1).optional(),
      reactionChance: z.number().min(0).max(1).optional(),
      stickerChance: z.number().min(0).max(1).optional(),
      imageChance: z.number().min(0).max(1).optional(),
      videoChance: z.number().min(0).max(1).optional(),
      documentChance: z.number().min(0).max(1).optional(),
      locationChance: z.number().min(0).max(1).optional(),
      contactChance: z.number().min(0).max(1).optional(),
      pollChance: z.number().min(0).max(1).optional(),
      minDelay: z.number().min(1000).max(300000).optional(),
      maxDelay: z.number().min(1000).max(600000).optional(),
      groupChance: z.number().min(0).max(1).optional(),
      externalNumbersChance: z.number().min(0).max(1).optional(),
      groupId: z.string().optional(),
      externalNumbers: z.array(z.string()).optional(),
      typingSimulation: z.boolean().optional(),
      onlineStatusSimulation: z.boolean().optional(),
      readReceiptSimulation: z.boolean().optional(),
      activeHours: z
        .object({
          start: z.number().min(0).max(23),
          end: z.number().min(0).max(23),
        })
        .optional(),
      weekendBehavior: z.enum(["normal", "reduced", "disabled"]).optional(),
      autoReplyChance: z.number().min(0).max(1).optional(),
      replyDelay: z
        .object({
          min: z.number().min(1000).max(30000),
          max: z.number().min(1000).max(60000),
        })
        .optional(),
      statusUpdateChance: z.number().min(0).max(1).optional(),
      statusTexts: z.array(z.string()).optional(),
      profileUpdateChance: z.number().min(0).max(1).optional(),
      profileNames: z.array(z.string()).optional(),
      profileBios: z.array(z.string()).optional(),
      groupJoinChance: z.number().min(0).max(1).optional(),
      groupLeaveChance: z.number().min(0).max(1).optional(),
      groupInviteChance: z.number().min(0).max(1).optional(),
      mediaDownloadChance: z.number().min(0).max(1).optional(),
      mediaForwardChance: z.number().min(0).max(1).optional(),
      antiDetectionMode: z.boolean().optional(),
      randomDeviceInfo: z.boolean().optional(),
      messageQuality: z.enum(["low", "medium", "high"]).optional(),
      engagementOptimization: z.boolean().optional(),
    })
    .optional(),
});

// ================================
// TIPOS TYPESCRIPT
// ================================

export type User = typeof usersTables.$inferSelect;
export type NewUser = typeof usersTables.$inferInsert;

// Definição do tipo para o JSON de contagem de mensagens
export type MessageTypeCounts = {
  text?: number;
  audio?: number;
  sticker?: number;
  button?: number;
  list?: number;
  media?: number; // Para imagens, vídeos, documentos, etc.
};

export type Instance = Omit<
  typeof instancesTables.$inferSelect,
  "typeMessagesSent"
> & {
  typeMessagesSent: MessageTypeCounts;
};
export type NewInstance = typeof instancesTables.$inferInsert;

// Tipos para Warmup
export type WarmupConfig = typeof warmupConfigsTables.$inferSelect;
export type NewWarmupConfig = typeof warmupConfigsTables.$inferInsert;

export type WarmupContent = typeof warmupContentsTables.$inferSelect;
export type NewWarmupContent = typeof warmupContentsTables.$inferInsert;

export type WarmupStats = typeof warmupStatsTables.$inferSelect;
export type NewWarmupStats = typeof warmupStatsTables.$inferInsert;

export type MediaStats = typeof mediaStatsTables.$inferSelect;
export type NewMediaStats = typeof mediaStatsTables.$inferInsert;

export type WarmupLog = typeof warmupLogsTables.$inferSelect;
export type NewWarmupLog = typeof warmupLogsTables.$inferInsert;
