-- CreateTable
CREATE TABLE "api_fetch_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "headers_json" JSONB NOT NULL,
    "response_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_fetch_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_fetch_sessions_user_id_idx" ON "api_fetch_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "api_fetch_sessions" ADD CONSTRAINT "api_fetch_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
