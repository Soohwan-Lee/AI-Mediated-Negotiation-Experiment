/* eslint-disable @typescript-eslint/no-unused-expressions */
async (page) => {
  const origin = "http://localhost:3141";
  const policies = ["user_specified", "ai_supplemented"];
  const roles = ["leader", "member"];
  const templates = {
    seq1: [["direct", "task_a"], [null, "task_b"]],
    seq2: [[null, "task_a"], ["direct", "task_b"]],
    seq3: [["direct", "task_b"], [null, "task_a"]],
    seq4: [[null, "task_b"], ["direct", "task_a"]],
  };
  const jobs = [];
  let assignment;
  let number = 0;
  for (const policy of policies) for (const role of roles) {
    for (const [sequenceId, template] of Object.entries(templates)) {
      number += 1;
      const sessions = template.map(([condition, taskId], index) => ({
        index: index + 1,
        condition: condition || policy,
        taskId,
      }));
      const base = {
        participantKey: `P-practice-${number}`,
        proxyPolicy: policy,
        role,
        sequenceId,
        sessionOrder: ["seq1", "seq3"].includes(sequenceId) ? "direct_first" : "proxy_first",
        sessions,
        assignedAt: "2026-09-11T00:00:00.000Z",
      };
      for (const taskIndex of [1, 2]) jobs.push({ assignment: base, taskIndex });
    }
  }

  const escaped = [];
  await page.context().addInitScript(() => {
    const add = window.addEventListener.bind(window);
    window.addEventListener = (type, listener, options) => {
      if (type !== "beforeunload") add(type, listener, options);
    };
  });
  await page.context().route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(`${origin}/`) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      escaped.push(url);
      return route.abort("blockedbyclient");
    }
    const pathname = url.startsWith(origin) ? url.slice(origin.length).split("?")[0] : "";
    if (pathname === "/api/assign") return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ assignment, status: "active", consented: true }),
    });
    if (pathname === "/api/persist") return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
    if (pathname.startsWith("/api/")) return route.abort("blockedbyclient");
    return route.continue();
  });
  const results = [];
  for (const job of jobs) {
    assignment = job.assignment;
    const { taskIndex } = job;
    const condition = assignment.sessions[taskIndex - 1].condition;
    const isProxy = condition !== "direct";
    await page.goto(`${origin}/instruction`, { waitUntil: "domcontentloaded" });
    await page.evaluate(({ participantKey, taskIndex }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(
        `amne:check-gate:${participantKey}:common`,
        JSON.stringify({ status: "passed", attempts: 2 }),
      );
      // The second practice is only reachable after the first measured task.
      // This harness performs genuine practice controls, but seeds that prior
      // completed run so each assignment arm can be checked independently.
      if (taskIndex === 2) {
        localStorage.setItem(
          `amne:task-run:${participantKey}:1`,
          JSON.stringify({
            status: "completed",
            startedAt: "2026-09-11T00:00:00.000Z",
            completedAt: "2026-09-11T00:01:00.000Z",
          }),
        );
      }
    }, { participantKey: assignment.participantKey, taskIndex });
    await page.goto(`${origin}/practice/${taskIndex}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: taskIndex === 1 ? "Start practice" : "Start the short practice", exact: true }).click();
    await page.getByRole("button", { name: /^I've read it/ }).click();
    await page.getByRole("button", { name: /^Got it/ }).click();
    if (isProxy) {
      const send = page.getByRole("button", { name: "Send", exact: true });
      await send.waitFor({ state: "visible", timeout: 30000 });
      await send.click({ timeout: 30000 });
      const accept = page.getByRole("button", { name: "Accept current offer", exact: true });
      await accept.waitFor({ state: "visible", timeout: 10000 });
      await accept.click();
      await page.getByRole("radio", { name: /You talk with the other participant and both confirm/ }).check();
    } else {
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const accept = page.getByRole("button", { name: "Accept current offer", exact: true });
      await accept.waitFor({ state: "visible", timeout: 10000 });
      await accept.click();
      await page.getByRole("radio", { name: "You", exact: true }).check();
    }
    await page.getByRole("button", { name: "Check My Answer", exact: true }).last().click();
    await page.getByRole("button", { name: new RegExp(`^Start Task ${taskIndex} \\(Real Session\\)`) }).first().click();
    await page.waitForURL(`${origin}/task/${taskIndex}`, { timeout: 10000 });
    await page.getByRole("heading", {
      name: taskIndex === 1 ? "Task 1 Starts Here" : "Task 2 (Final Task)",
      exact: true,
    }).waitFor();
    const gate = await page.evaluate(({ participantKey, taskIndex }) =>
      JSON.parse(localStorage.getItem(`amne:check-gate:${participantKey}:task-${taskIndex}`))?.status,
      { participantKey: assignment.participantKey, taskIndex },
    );
    results.push({
      policy: assignment.proxyPolicy,
      role: assignment.role,
      sequenceId: assignment.sequenceId,
      taskIndex,
      condition,
      gate,
      path: page.url().slice(origin.length),
    });
  }
  const failures = results.filter((result) =>
    result.gate !== "passed" || result.path !== `/task/${result.taskIndex}`,
  );
  if (failures.length > 0 || escaped.length > 0 || results.length !== 32) {
    throw new Error(JSON.stringify({ results: results.length, failures, escaped }));
  }
  return { assignmentCells: 16, practiceViews: results.length, failures, escaped };
}
