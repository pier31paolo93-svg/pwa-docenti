// Local Docker only. Never accepts a remote URL or prints API keys.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");
(async () => {
  const cli = execFileSync(
    process.execPath,
    ["node_modules/supabase/dist/supabase.js", "status", "--output", "json"],
    { encoding: "utf8" },
  );
  const config = JSON.parse(cli);
  const url = config.API_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):56321$/.test(url))
    throw Error("Local API required");
  const admin = createClient(url, config.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const {
    data: { users },
    error,
  } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const credentials = [];
  for (let i = 1; i <= 2; i++) {
    const email = `frontend-test-${i}@example.invalid`;
    const password = "LocalOnly!Fixture2026#";
    let user = users.find((u) => u.email === email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Docente fittizio " + i },
      });
      if (error) throw error;
      user = data.user;
    } else {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
    }
    const client = createClient(url, config.ANON_KEY, {
      auth: { persistSession: false },
    });
    const { error: login } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (login) throw login;
    const { data: w, error: werr } = await client
      .from("workspaces")
      .select("*")
      .eq("owner_id", user.id)
      .single();
    if (werr) throw werr;
    const rows = {};
    async function add(table, patch) {
      const { data: existing, error: readError } = await client
        .from(table)
        .select("*")
        .eq("workspace_id", w.id);
      if (readError) throw readError;
      if (existing.length) {
        rows[table] = existing[0];
        return existing[0];
      }
      const { data, error } = await client.rpc("sync_mutation", {
        p_operation: crypto.randomUUID(),
        p_table: table,
        p_id: crypto.randomUUID(),
        p_workspace: w.id,
        p_expected_version: 0,
        p_patch: patch,
      });
      if (error) throw error;
      rows[table] = data;
      return data;
    }
    await add("school_years", {
      label: "2026/2027 test",
      starts_on: "2026-09-01",
      ends_on: "2027-08-31",
    });
    await add("schools", { name: "Scuola fittizia E2E", code: "E2E" });
    await add("subjects", { name: "Matematica test", code: "MAT" });
    await add("classes", {
      name: "1T test",
      school_id: rows.schools.id,
      school_year_id: rows.school_years.id,
    });
    await add("students", {
      first_name: "Studente",
      last_name: "Fittizio " + i,
      external_code: "TEST-" + i,
    });
    await add("enrollments", {
      student_id: rows.students.id,
      class_id: rows.classes.id,
      starts_on: "2026-09-01",
    });
    await add("class_subjects", {
      class_id: rows.classes.id,
      subject_id: rows.subjects.id,
    });
    await add("teaching_assignments", {
      class_subject_id: rows.class_subjects.id,
      class_id: rows.classes.id,
      teacher_id: user.id,
    });
    await add("observation_types", {
      code: "PAR",
      description: "Partecipazione",
      disciplinary_default: false,
    });
    await add("evaluation_categories", {
      code: "DISC",
      name: "Disciplinare",
      contributes_to_average: true,
    });
    await add("evaluation_rules", {
      name: "Lineare 1–10",
      minimum: 1,
      maximum: 10,
      rounding_step: 0.1,
      conversion_points: [
        [0, 0],
        [1, 1],
      ],
    });
    await add("lessons", {
      teaching_assignment_id: rows.teaching_assignments.id,
      title: "Lezione fittizia E2E",
      starts_at: "2026-10-22T08:00:00Z",
      ends_at: "2026-10-22T09:00:00Z",
      status: "draft",
    });
    await add("assignments", {
      teaching_assignment_id: rows.teaching_assignments.id,
      class_id: rows.classes.id,
      title: "Compiti fittizi E2E",
      assigned_on: "2026-10-22",
      due_on: "2026-10-25",
    });
    await add("assignment_exercises", {
      assignment_id: rows.assignments.id,
      description: "Esercizio di test",
      position: 1,
    });
    await add("assessments", {
      teaching_assignment_id: rows.teaching_assignments.id,
      class_id: rows.classes.id,
      title: "Prova fittizia E2E",
      assessed_on: "2026-10-22",
      kind: "written",
      correction_mode: "quick",
    });
    await add("assessment_questions", {
      assessment_id: rows.assessments.id,
      label: "Quesito di test",
      max_score: 10,
    });
    credentials.push({ email, password, id: user.id, workspace: w.id, rows });
    await client.auth.signOut();
  }
  fs.mkdirSync(".local-test", { recursive: true });
  fs.writeFileSync(".local-test/e2e-users.json", JSON.stringify(credentials));
  fs.writeFileSync(
    ".env.test.local",
    `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${config.PUBLISHABLE_KEY || config.ANON_KEY}\n`,
  );
  console.log(
    "Two fictitious local accounts ready; local environment stored in ignored files.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
