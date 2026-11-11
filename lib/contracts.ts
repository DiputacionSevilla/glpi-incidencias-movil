export type TicketStatus = "new" | "processing" | "planned" | "pending" | "solved" | "closed";
export type TicketPriority = "very-low" | "low" | "medium" | "high" | "very-high" | "major";

export type GlpiUser = {
  id: number;
  name: string;
};

export type TicketSummary = {
  id: number;
  title: string;
  openedAt: string;
  updatedAt: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterName?: string;
  locationName?: string;
  ageLabel: string;
};

export type Followup = {
  id: number;
  authorName: string;
  createdAt: string;
  contentText: string;
  isPrivate: boolean;
};

export type TicketDetail = TicketSummary & {
  descriptionText: string;
  requester?: GlpiUser;
  categoryName?: string;
  entityName?: string;
  assignedTechnicians: Array<{ id: number; name: string }>;
  followups: Followup[];
  allowedActions: {
    addFollowup: boolean;
    addPrivateFollowup: boolean;
    resolve: boolean;
    close: boolean;
    edit: boolean;
  };
};
