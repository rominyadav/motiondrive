CREATE TABLE "shared_link" (
	"id" text PRIMARY KEY NOT NULL,
	"assetId" text,
	"physicalKey" text,
	"folderId" text,
	"physicalPrefix" text,
	"physicalBucket" text,
	"filename" text NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"isRevoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "userId" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sharedWith" text DEFAULT 'all';--> statement-breakpoint
ALTER TABLE "shared_link" ADD CONSTRAINT "shared_link_assetId_asset_id_fk" FOREIGN KEY ("assetId") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_link" ADD CONSTRAINT "shared_link_folderId_folder_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_link" ADD CONSTRAINT "shared_link_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;