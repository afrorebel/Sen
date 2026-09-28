import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { addComment, applyDfyTemplate, createDeliverable, createTask, setTaskStatus } from "@/app/actions/work";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { Empty } from "@/app/components/ui";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands, deliverables, taskComments, tasks, users, type TaskStatus } from "@/lib/db/schema";

export const metadata = { title: "Work · AEOGrowthLeads" };

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "review", label: "In review" },
  { id: "done", label: "Done" },
];

const DELIVERABLE_TYPES: Record<string, string> = {
  article: "Article",
  reddit: "Reddit post",
  linkedin: "LinkedIn post",
  schema: "Schema markup",
  llms_txt: "llms.txt",
  gbp_post: "Google Business post",
  press: "Press release",
  report: "Report",
  fix: "Technical fix",
  other: "Other",
};

export default async function WorkPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const { org, canEdit, role } = await requireOrg(user, orgId);
  const clientView = role === "client" && !user.isStaff;

  const taskRows = await db
    .select({ task: tasks, assignee: users.name })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.orgId, orgId), clientView ? eq(tasks.clientVisible, true) : undefined))
    .orderBy(asc(tasks.dueDate), asc(tasks.createdAt));
  const comments = taskRows.length
    ? await db
        .select({ c: taskComments, author: users.name, staff: users.isStaff })
        .from(taskComments)
        .innerJoin(users, eq(users.id, taskComments.userId))
        .where(inArray(taskComments.taskId, taskRows.map((t) => t.task.id)))
        .orderBy(asc(taskComments.createdAt))
    : [];
  const delivered = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.orgId, orgId))
    .orderBy(desc(deliverables.deliveredAt))
    .limit(50);
  const brandRows = await db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.orgId, orgId));
  const staffRows = user.isStaff
    ? await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isStaff, true))
    : [];

  const done = taskRows.filter((t) => t.task.status === "done").length;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>{org.doneForYou ? "Done-for-you work" : "Tasks"}</h1>
          <p className="muted">
            {taskRows.length ? `${done} of ${taskRows.length} tasks complete` : "Nothing scheduled yet"} ·{" "}
            {delivered.length} deliverable{delivered.length === 1 ? "" : "s"} shipped
          </p>
        </div>
        {user.isStaff && taskRows.length === 0 && (
          <form action={applyDfyTemplate.bind(null, orgId)}>
            <SubmitButton className="btn ghost">Load onboarding plan</SubmitButton>
          </form>
        )}
      </div>

      {taskRows.length ? (
        <section className="board">
          {COLUMNS.map((col) => (
            <div key={col.id} className="column">
              <h2>
                {col.label} <span className="muted small">{taskRows.filter((t) => t.task.status === col.id).length}</span>
              </h2>
              {taskRows
                .filter((t) => t.task.status === col.id)
                .map(({ task, assignee }) => {
                  const thread = comments.filter((c) => c.c.taskId === task.id);
                  return (
                    <article key={task.id} className={`task ${task.category}`}>
                      <div className="task-meta">
                        <span className="tag">{task.category}</span>
                        {!task.clientVisible && <span className="tag internal">internal</span>}
                        {task.dueDate && <span className="muted small">due {task.dueDate.toLocaleDateString()}</span>}
                      </div>
                      <h3>{task.title}</h3>
                      {task.description && <p className="muted small">{task.description}</p>}
                      {assignee && <p className="small">Owner: {assignee}</p>}
                      {canEdit && (
                        <div className="task-actions">
                          {COLUMNS.filter((c) => c.id !== task.status).map((c) => (
                            <form key={c.id} action={setTaskStatus.bind(null, task.id, c.id)}>
                              <button className="linklike small">→ {c.label}</button>
                            </form>
                          ))}
                        </div>
                      )}
                      <details>
                        <summary className="small">
                          {thread.length} comment{thread.length === 1 ? "" : "s"}
                        </summary>
                        {thread.map(({ c, author, staff }) => (
                          <p key={c.id} className="comment small">
                            <b>{author}</b>
                            {staff && <span className="tag">team</span>} {c.body}
                          </p>
                        ))}
                        <ActionForm action={addComment.bind(null, task.id)} resetOnSuccess className="stack tight">
                          <textarea name="body" rows={2} placeholder="Add a comment or question" required />
                          <SubmitButton className="btn small">Post</SubmitButton>
                        </ActionForm>
                      </details>
                    </article>
                  );
                })}
            </div>
          ))}
        </section>
      ) : (
        <Empty title="No tasks yet">
          <p className="muted">
            {clientView
              ? "Our team will add your onboarding plan here shortly."
              : "Add tasks below, or staff can load the standard onboarding plan."}
          </p>
        </Empty>
      )}

      <section className="two-col">
        <div className="card">
          <h2>Deliverables</h2>
          {delivered.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Delivered</th>
                    <th>Type</th>
                    <th>Item</th>
                  </tr>
                </thead>
                <tbody>
                  {delivered.map((d) => (
                    <tr key={d.id}>
                      <td className="num">{d.deliveredAt.toLocaleDateString()}</td>
                      <td>{DELIVERABLE_TYPES[d.type] ?? d.type}</td>
                      <td>
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noreferrer">
                            {d.title}
                          </a>
                        ) : (
                          d.title
                        )}
                        {d.notes && <div className="muted small">{d.notes}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Articles, fixes, posts and reports will be listed here as they ship.</p>
          )}
        </div>

        {canEdit && (
          <div className="stack">
            <div className="card">
              <h2>Log a deliverable</h2>
              <ActionForm action={createDeliverable.bind(null, orgId)} resetOnSuccess>
                <input name="title" placeholder="How much does water damage restoration cost in 2026?" required />
                <div className="field-row">
                  <select name="type" defaultValue="article" aria-label="Type">
                    {Object.entries(DELIVERABLE_TYPES).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select name="taskId" defaultValue="" aria-label="Related task">
                    <option value="">No related task</option>
                    {taskRows.map(({ task }) => (
                      <option key={task.id} value={task.id}>
                        {task.title.slice(0, 60)}
                      </option>
                    ))}
                  </select>
                </div>
                <input name="url" type="url" placeholder="https://… (live link, doc or file)" />
                <textarea name="notes" rows={2} placeholder="Notes for the client (optional)" />
                <SubmitButton>Log deliverable</SubmitButton>
              </ActionForm>
            </div>
            <div className="card">
              <h2>Add a task</h2>
              <ActionForm action={createTask.bind(null, orgId)} resetOnSuccess>
                <input name="title" placeholder="Task title" required />
                <textarea name="description" rows={2} placeholder="Details (optional)" />
                <div className="field-row">
                  <select name="category" defaultValue="technical" aria-label="Category">
                    <option value="technical">Technical</option>
                    <option value="content">Content</option>
                    <option value="citations">Citations</option>
                    <option value="local">Local / GBP</option>
                    <option value="reporting">Reporting</option>
                    <option value="other">Other</option>
                  </select>
                  <input name="dueDate" type="date" aria-label="Due date" />
                </div>
                {brandRows.length > 1 && (
                  <select name="brandId" defaultValue="" aria-label="Brand">
                    <option value="">All brands</option>
                    {brandRows.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
                {user.isStaff && (
                  <div className="field-row">
                    <select name="assigneeId" defaultValue="" aria-label="Assignee">
                      <option value="">Unassigned</option>
                      {staffRows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <label className="check-label">
                      <input type="checkbox" name="clientVisible" defaultChecked /> Visible to client
                    </label>
                  </div>
                )}
                <SubmitButton>Add task</SubmitButton>
              </ActionForm>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
