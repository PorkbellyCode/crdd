/**
 * CRDD 저장 스키마 (Turso / libSQL).
 *
 * 설계 근거는 프로젝트 문서:
 *   - concept 단위 점수와 history: "CRDD 이해도 점수 유지 설계"
 *   - concept 키는 이름도 communityId도 아닌 영속 키(key): "CRDD concept 이름 생성 규칙"
 *     (communityId는 재분석마다 다시 매겨지므로 파일 집합 유사도로 키를 이어받는다
 *      — src/lib/crdd/identity.ts)
 *   - 변경 감지는 blob SHA 스냅샷 비교: "CRDD 웹앱 전환 단계별 계획"
 *
 * 큰 JSON(graph, map, 해시 스냅샷)은 지금은 text 컬럼에 둔다. porklog 기준
 * 수백 KB라 문제없지만, 큰 레포에서 수 MB가 되면 오브젝트 스토리지로 빼고
 * 여기에는 참조만 남기는 게 맞다.
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

/** 프로젝트 = 레포 하나. 식별 키는 첫 커밋 SHA (경로·이름이 바뀌어도 유지된다) */
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    /** "owner/repo" */
    repo: text("repo").notNull(),
    rootCommit: text("root_commit"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (table) => [uniqueIndex("projects_repo_idx").on(table.repo)],
);

/** 한 커밋 시점의 분석 결과 스냅샷 */
export const analyses = sqliteTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    commit: text("commit").notNull(),
    /** 화면이 바로 그리는 MapData (좌표 포함) */
    mapJson: text("map_json").notNull(),
    /** 파일 경로 → blob SHA. 다음 분석 때 stale 판정에 쓴다 */
    fileHashesJson: text("file_hashes_json").notNull(),
    /** 이 분석의 communityId → concept 영속 키. 과거 분석 화면도 점수를 정확히 찾게 한다 */
    conceptKeysJson: text("concept_keys_json"),
    nodeCount: integer("node_count").notNull(),
    edgeCount: integer("edge_count").notNull(),
    conceptCount: integer("concept_count").notNull(),
    /** clone/extract/layout 소요 시간 */
    timingsJson: text("timings_json"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (table) => [
    index("analyses_project_idx").on(table.projectId),
    uniqueIndex("analyses_project_commit_idx").on(table.projectId, table.commit),
  ],
);

/**
 * concept = Graphify 커뮤니티 하나.
 *
 * 이름도 communityId도 키가 아니다. 이름은 2차(LLM)·수동으로 바뀌고, communityId는
 * 재분석마다 다시 매겨진다. 점수는 영속 키(key)에 붙는다.
 */
export const concepts = sqliteTable(
  "concepts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** 영속 키 — 처음 생길 때 `c<communityId>-<파일 집합 해시>`, 이후 불변 */
    key: text("key").notNull(),
    /** 최신 분석에서의 커뮤니티 번호 (표시·조회용, 키 아님) */
    communityId: integer("community_id").notNull(),
    /** 최신 분석에 이 concept이 남아 있는지. 사라진 concept도 이력 보존을 위해 지우지 않는다 */
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    name: text("name").notNull(),
    /** 어떤 규칙으로 이름이 나왔는지 — 화면에 근거를 보여줄 수 있게 */
    nameRule: text("name_rule"),
    /** auto = 결정론적 1차, llm = 사용자 키로 다듬음, manual = 사용자가 고침 */
    nameSource: text("name_source").notNull().default("auto"),
    filesJson: text("files_json").notNull(),
    nodeCount: integer("node_count").notNull(),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("concepts_project_key_idx").on(table.projectId, table.key),
    index("concepts_project_community_idx").on(table.projectId, table.communityId),
  ],
);

/**
 * 사용자 × concept의 이해도.
 *
 * score는 내부 계산용이고 화면에는 부채비율(100 - score)만 노출한다.
 * userId는 로그인이 붙기 전(P3)까지 익명 기기 ID(쿠키 crdd_uid)다.
 */
export const scores = sqliteTable(
  "scores",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().default("local"),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    conceptKey: text("concept_key").notNull(),
    score: integer("score").notNull().default(0),
    /** 이 점수를 검증한 시점의 커밋 — 이후 파일이 바뀌면 stale */
    lastVerifiedCommit: text("last_verified_commit"),
    lastQuizAt: integer("last_quiz_at"),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("scores_user_project_concept_idx").on(
      table.userId,
      table.projectId,
      table.conceptKey,
    ),
  ],
);

/** 퀴즈 결과 이력. 점수 공식이 과거 세션을 모두 합산하므로 지우면 안 된다 */
export const history = sqliteTable(
  "history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().default("local"),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    conceptKey: text("concept_key").notNull(),
    commit: text("commit").notNull(),
    /** 배점 차등이 반영된 가중 정답 수라 정수가 아니다 */
    correct: real("correct").notNull(),
    total: integer("total").notNull(),
    scoreBefore: integer("score_before").notNull(),
    scoreAfter: integer("score_after").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (table) => [
    index("history_user_project_idx").on(table.userId, table.projectId),
    index("history_user_concept_idx").on(table.userId, table.projectId, table.conceptKey),
  ],
);

/** 분석 작업. 인메모리 Map을 대체한다 — 재시작해도 결과가 남는다 */
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    repo: text("repo").notNull(),
    /** queued | running | done | error */
    status: text("status").notNull().default("queued"),
    step: text("step").notNull().default("queued"),
    error: text("error"),
    projectId: text("project_id"),
    analysisId: text("analysis_id"),
    createdAt: integer("created_at").notNull().default(now),
    finishedAt: integer("finished_at"),
  },
  (table) => [index("jobs_status_idx").on(table.status)],
);

/**
 * 퀴즈 세션 하나 = concept 하나에 대한 문항 묶음.
 *
 * rubric·힌트·설명이 들어 있는 questionsJson은 서버 밖으로 그대로 내보내지 않는다.
 * 화면에는 src/lib/quiz/view.ts가 단계에 맞게 걸러낸 형태만 간다.
 */
export const quizzes = sqliteTable(
  "quizzes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    analysisId: text("analysis_id").notNull(),
    conceptKey: text("concept_key").notNull(),
    conceptName: text("concept_name").notNull(),
    commit: text("commit").notNull(),
    /** 출제에 쓴 모델 — 사용자가 고른 것. 키는 저장하지 않는다 */
    model: text("model").notNull(),
    /** active | done */
    status: text("status").notNull().default("active"),
    questionsJson: text("questions_json").notNull(),
    progressJson: text("progress_json").notNull(),
    /** 완료 시 결과 요약 (부채비율 전후) */
    resultJson: text("result_json"),
    createdAt: integer("created_at").notNull().default(now),
    finishedAt: integer("finished_at"),
  },
  (table) => [index("quizzes_user_project_idx").on(table.userId, table.projectId)],
);
